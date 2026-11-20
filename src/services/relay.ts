import type { RelayEndpointMode, RelayProviderConfig } from '@/types/gallery'

export const RELAY_ENDPOINTS: Record<RelayEndpointMode, string> = {
  images_edits_json: 'Images Edits（JSON）',
  images_edits: 'Images Edits（文件上传）',
  chat: 'Chat Completions（图像输出）',
}

export function relayApiBase(baseUrl: string): string {
  let url: URL
  try {
    url = new URL(baseUrl.trim())
  } catch {
    throw new Error('请填写有效的中转站 Base URL')
  }

  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('中转站地址须为 HTTPS（本机可用 HTTP），且不能包含账号、查询参数或片段')
  }

  const path = url.pathname.replace(/\/+$/, '')
  return `${url.origin}${path}${/\/v\d+$/.test(path) ? '' : '/v1'}`
}

export function normalizeRelayModels(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.flatMap((id) => typeof id === 'string' && id.trim() ? [id.trim()] : []))]
}

export function relayModelIds(config: RelayProviderConfig): string[] {
  return normalizeRelayModels([...config.manualModels, ...config.fetchedModels])
}

export function relayFetch(target: string, init: RequestInit, useProxy: boolean): Promise<Response> {
  const headers = new Headers(init.headers)
  if (useProxy) {
    headers.set('x-target-url', target)
    if (init.method === 'GET') headers.set('x-proxy-mode', 'model-list')
  }
  return fetch(useProxy ? '/api/proxy' : target, {
    ...init, headers, redirect: 'error', credentials: 'omit', cache: 'no-store',
  })
}

export async function fetchRelayModels(
  config: Pick<RelayProviderConfig, 'baseUrl' | 'apiKey'>,
  useProxy: boolean,
  signal?: AbortSignal,
): Promise<string[]> {
  const target = `${relayApiBase(config.baseUrl)}/models`
  const key = config.apiKey.trim()
  if (!key) throw new Error('请先填写中转站 API Key')

  const timeout = AbortSignal.timeout(15000)
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout
  try {
    const response = await relayFetch(target, {
      method: 'GET', headers: { Authorization: `Bearer ${key}` }, signal: requestSignal,
    }, useProxy)
    if (!response.ok) {
      if (response.status === 401) throw new Error('中转站鉴权失败，请检查 API Key（HTTP 401）')
      if (useProxy && response.status === 403) throw new Error('访问被拒绝，请检查 API Key 权限及服务端 PROXY_ALLOWED_ORIGINS 白名单（HTTP 403）')
      throw new Error(`拉取模型失败（HTTP ${response.status}），也可以手动添加模型 ID`)
    }
    const body = await response.json() as { data?: { id?: unknown }[] } | null
    if (!Array.isArray(body?.data)) throw new Error('模型列表格式不兼容，可以手动添加模型 ID')
    return normalizeRelayModels(body.data.map((item) => item?.id))
  } catch (error) {
    if (signal?.aborted) throw error
    if (timeout.aborted) throw new Error('拉取模型超时，请重试或手动添加模型 ID')
    if (error instanceof SyntaxError) throw new Error('模型列表不是有效的 JSON，可以手动添加模型 ID')
    if (error instanceof TypeError) {
      throw new Error('无法连接中转站，请检查地址、网络或跨域设置；也可以手动添加模型 ID')
    }
    throw error
  }
}
