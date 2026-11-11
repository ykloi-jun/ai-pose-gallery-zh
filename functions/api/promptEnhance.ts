import type { ProxyEnv } from './proxy.js'
import { isOriginAllowed } from './proxy.js'

const jsonResponse = (status: number, message: string) =>
  new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })

export async function onRequestPromptEnhance(context: { request: Request; env?: ProxyEnv }): Promise<Response> {
  const { request, env } = context
  if (request.method !== 'POST') return jsonResponse(405, 'Method Not Allowed')

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(contentLength) && contentLength > 256 * 1024) {
    return jsonResponse(413, '提示词增强请求过大')
  }

  let payload: Record<string, unknown>
  try {
    payload = await request.json() as Record<string, unknown>
  } catch {
    return jsonResponse(400, '无效的 JSON 请求')
  }

  const baseUrl = typeof payload.baseUrl === 'string' ? payload.baseUrl.trim() : ''
  const apiKey = typeof payload.apiKey === 'string' ? payload.apiKey.trim() : ''
  const model = typeof payload.model === 'string' ? payload.model.trim() : ''
  const basePrompt = typeof payload.basePrompt === 'string' ? payload.basePrompt.trim() : ''
  const referenceContext = typeof payload.referenceContext === 'string' ? payload.referenceContext.trim() : ''
  const stylePreset = typeof payload.stylePreset === 'string' ? payload.stylePreset.trim() : ''

  if (!apiKey || !model || !basePrompt) return jsonResponse(400, '请先配置增强模型的 API Key、模型 ID，并确保基础提示词不为空')
  if (apiKey.length > 4096 || model.length > 200 || basePrompt.length > 30_000 || referenceContext.length > 12_000) {
    return jsonResponse(413, '提示词增强内容超过长度限制')
  }

  let endpoint: URL
  try {
    endpoint = new URL(baseUrl)
  } catch {
    return jsonResponse(400, '增强模型 Base URL 无效')
  }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    return jsonResponse(400, '增强模型 Base URL 必须是标准 HTTPS 地址')
  }
  if (!isOriginAllowed(endpoint, env?.PROXY_ALLOWED_ORIGINS)) {
    return jsonResponse(403, '增强模型 API 域名未加入服务端允许列表')
  }

  const basePath = endpoint.pathname.replace(/\/+$/, '')
  if (!basePath.endsWith('/chat/completions')) endpoint.pathname = `${basePath}/chat/completions`
  endpoint.search = ''
  endpoint.hash = ''

  const systemPrompt = [
    '你是一名专业的图像生成提示词编辑助手。根据参考图组合信息，对基础提示词进行清晰、具体、可执行的增强。',
    '保留原有创作意图、人物身份、身材、服装、姿势、镜头、画风和限制，不擅自添加参考信息中不存在的外观或细节。',
    '明确区分各参考图的用途和编号，避免重复人物、肢体冲突及模糊的图像指代。可以重排和润色，但不要删除基础提示词中的重要要求。',
    '只输出增强后的完整提示词，不要解释、标题、Markdown 代码块或前言。',
  ].join('\n')
  const userPrompt = [
    `画风预设：${stylePreset || '未指定'}`,
    '参考图组合信息：',
    referenceContext || '无额外素材名称信息，请遵循基础提示词中的图片编号和用途。',
    '',
    '基础提示词：',
    basePrompt,
  ].join('\n')

  try {
    const upstream = await fetch(endpoint.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(300_000),
    })

    const responseText = await upstream.text()
    if (responseText.length > 1024 * 1024) return jsonResponse(502, '增强模型响应过大')
    let result: any
    try {
      result = JSON.parse(responseText)
    } catch {
      return jsonResponse(502, '增强模型返回了无效响应')
    }
    if (!upstream.ok) {
      const message = result?.error?.message || result?.message || `上游 API 返回 HTTP ${upstream.status}`
      return jsonResponse(upstream.status >= 400 && upstream.status < 500 ? upstream.status : 502, String(message).slice(0, 1000))
    }

    const content = result?.choices?.[0]?.message?.content
    const prompt = typeof content === 'string'
      ? content.trim()
      : Array.isArray(content)
        ? content.filter((part: unknown): part is { text: string } => typeof part === 'object' && part !== null && 'text' in part && typeof part.text === 'string').map((part) => part.text).join('\n').trim()
        : ''
    if (!prompt) return jsonResponse(502, '增强模型响应中没有提示词文本')
    return new Response(JSON.stringify({ prompt }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError'
      ? '提示词增强已等待 300 秒仍未收到模型响应，请检查模型服务状态后重试'
      : error instanceof Error ? error.message : '提示词增强请求失败'
    return jsonResponse(502, message)
  }
}
