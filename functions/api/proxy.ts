// Cloudflare Pages Function / Worker: /api/proxy
// 用于在生产环境解决图像接口与结果图片的浏览器 CORS 限制
// 仅放行白名单内的上游域名，支持通过环境变量 PROXY_ALLOWED_ORIGINS 动态扩展（逗号/空格/换行分隔）。

export interface ProxyEnv {
  /**
   * 可选环境变量：动态配置允许通过 /api/proxy 转发的上游域名列表（多个规则用逗号、分号或空白分隔）。
   * 支持：
   * - 精确域名：`https://api.openai.com`
   * - 通配子域名：`https://*.openai.com`、`https://*.volces.com`
   * - 全部放行：`*`
   */
  PROXY_ALLOWED_ORIGINS?: string
}

/**
 * 默认允许转发的上游 origin 规则。
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'https://dashscope.aliyuncs.com', // 阿里云百炼 / Qwen
  'https://ark.cn-beijing.volces.com', // 火山方舟 / Doubao
  'https://generativelanguage.googleapis.com', // Google Gemini
  'https://api.openai.com', // OpenAI
  'https://api.bblabu.ai', // BBLABU compatible image endpoint
]

const DEFAULT_IMAGE_ORIGINS = ['https://tmp.cangyuansuanli.cn']
const MAX_IMAGE_RESPONSE_BYTES = 25 * 1024 * 1024

function matchOriginRule(target: URL, rawRule: string): boolean {
  const rule = rawRule.trim()
  if (!rule) return false
  if (rule === '*') return true

  // 支持通配子域名：例如 https://*.openai.com 或 *.openai.com
  const wildcardMatch = rule.match(/^(?:(https?):\/\/)?\*\.([a-z0-9.-]+)(?::(\d+))?(?:\/.*)?$/i)
  if (wildcardMatch) {
    const [, proto, baseHost, port] = wildcardMatch
    if (proto && `${proto.toLowerCase()}:` !== target.protocol) return false
    if ((port || '') !== target.port) return false
    const host = target.hostname.toLowerCase()
    const suffix = `.${baseHost.toLowerCase().replace(/^\.+|\.+$/g, '')}`
    return host.endsWith(suffix) && host.length > suffix.length
  }

  // 精确 origin 匹配
  try {
    const parsed = new URL(rule.includes('://') ? rule : `https://${rule}`)
    return parsed.origin === target.origin
  } catch {
    return false
  }
}

function getExtraOriginRules(envRaw?: string): string[] {
  return envRaw && typeof envRaw === 'string'
    ? envRaw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
    : []
}

export function isOriginAllowed(target: URL, envRaw?: string): boolean {
  return [...DEFAULT_ALLOWED_ORIGINS, ...getExtraOriginRules(envRaw)]
    .some((rule) => matchOriginRule(target, rule))
}

function isImageOriginAllowed(target: URL, envRaw?: string): boolean {
  return [...DEFAULT_IMAGE_ORIGINS, ...getExtraOriginRules(envRaw)]
    .some((rule) => matchOriginRule(target, rule))
}

/** 单次转发的请求体上限：生图接口携带 base64 图片时 10 MiB 足够。 */
const MAX_BODY_BYTES = 10 * 1024 * 1024

class BodyTooLargeError extends Error {}

const jsonResponse = (status: number, message: string) =>
  new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })

/**
 * 流式统计请求体大小，超限即中断。
 * 浏览器侧通常会带 content-length，这里兜底 chunked 上传的情况。
 */
const limitBodySize = (body: ReadableStream<Uint8Array> | null, limit: number) => {
  if (!body) return null
  let received = 0
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength
        if (received > limit) {
          controller.error(new BodyTooLargeError())
          return
        }
        controller.enqueue(chunk)
      },
    }),
  )
}

export const onRequestPost = async (context: { request: Request; env?: ProxyEnv }) => {
  const { request, env } = context

  const targetUrl = request.headers.get('x-target-url')
  if (!targetUrl) return jsonResponse(400, 'Missing x-target-url header')

  let target: URL
  try {
    target = new URL(targetUrl)
  } catch {
    return jsonResponse(400, 'Invalid x-target-url header')
  }

  // 只允许白名单（含环境变量 PROXY_ALLOWED_ORIGINS）内的 https 上游，其余一律拒绝
  if (target.protocol !== 'https:' || !isOriginAllowed(target, env?.PROXY_ALLOWED_ORIGINS)) {
    return jsonResponse(403, 'Target origin not allowed')
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonResponse(413, `Request body exceeds ${MAX_BODY_BYTES} bytes`)
  }

  const forwardHeaders = new Headers()
  for (const key of ['content-type', 'authorization', 'x-goog-api-key', 'x-dashscope-async']) {
    const val = request.headers.get(key)
    if (val) forwardHeaders.set(key, val)
  }

  try {
    const upstream = await fetch(target.toString(), {
      method: 'POST',
      headers: forwardHeaders,
      body: limitBodySize(request.body, MAX_BODY_BYTES),
    })
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      },
    })
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      return jsonResponse(413, `Request body exceeds ${MAX_BODY_BYTES} bytes`)
    }
    return jsonResponse(502, err instanceof Error ? err.message : 'Upstream proxy error')
  }
}


/** Fetch generated output images through the same origin so browsers do not need CDN CORS headers. */
export const onRequestGet = async (context: { request: Request; env?: ProxyEnv }) => {
  const targetUrl = context.request.headers.get('x-target-url')
  if (!targetUrl) return jsonResponse(400, 'Missing x-target-url header')

  let target: URL
  try {
    target = new URL(targetUrl)
  } catch {
    return jsonResponse(400, 'Invalid x-target-url header')
  }

  if (target.protocol !== 'https:' || !isImageOriginAllowed(target, context.env?.PROXY_ALLOWED_ORIGINS)) {
    return jsonResponse(403, 'Image origin not allowed')
  }

  try {
    let upstream: Response | undefined
    for (let redirects = 0; redirects <= 3; redirects++) {
      if (target.protocol !== 'https:' || !isImageOriginAllowed(target, context.env?.PROXY_ALLOWED_ORIGINS)) {
        return jsonResponse(403, 'Image redirect origin not allowed')
      }
      const response = await fetch(target.toString(), { method: 'GET', redirect: 'manual' })
      if (![301, 302, 303, 307, 308].includes(response.status)) {
        upstream = response
        break
      }
      const location = response.headers.get('location')
      if (!location || redirects === 3) return jsonResponse(502, 'Image redirect could not be followed')
      target = new URL(location, target)
    }

    if (!upstream) return jsonResponse(502, 'Image fetch failed')
    if (!upstream.ok) return jsonResponse(upstream.status, 'Image server returned HTTP ' + upstream.status)

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    if (!contentType.toLowerCase().startsWith('image/')) return jsonResponse(415, 'Upstream response is not an image')

    const declaredLength = Number(upstream.headers.get('content-length') ?? '0')
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_RESPONSE_BYTES) {
      return jsonResponse(413, 'Image response is too large')
    }

    const reader = upstream.body?.getReader()
    if (!reader) return jsonResponse(502, 'Image response is empty')
    const chunks: Uint8Array[] = []
    let total = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_IMAGE_RESPONSE_BYTES) {
        await reader.cancel()
        return jsonResponse(413, 'Image response is too large')
      }
      chunks.push(value)
    }
    const image = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      image.set(chunk, offset)
      offset += chunk.byteLength
    }
    return new Response(image, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return jsonResponse(502, error instanceof Error ? error.message : 'Image fetch failed')
  }
}
