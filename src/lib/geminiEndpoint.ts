export type GeminiEndpointMode = 'auto' | 'native' | 'openai_chat' | 'openai_images_edits' | 'openai_images_generations'

const GOOGLE_GEMINI_HOST = 'generativelanguage.googleapis.com'

export function isOpenAiCompatibleGeminiBaseUrl(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl)
    const path = url.pathname.replace(/\/+$/, '')
    return url.hostname.toLowerCase() !== GOOGLE_GEMINI_HOST && /\/v1$/i.test(path)
  } catch {
    return false
  }
}

export function migrateGeminiEndpointMode(mode: GeminiEndpointMode, baseUrl: string): GeminiEndpointMode {
  return mode === 'native' && isOpenAiCompatibleGeminiBaseUrl(baseUrl) ? 'auto' : mode
}

export function resolveGeminiEndpointMode(mode: GeminiEndpointMode, baseUrl: string): Exclude<GeminiEndpointMode, 'auto'> {
  if (mode !== 'auto') return mode
  return isOpenAiCompatibleGeminiBaseUrl(baseUrl) ? 'openai_images_edits' : 'native'
}

export interface GeminiRequestOptions {
  baseUrl: string
  endpointMode: GeminiEndpointMode
  model: string
  apiKey: string
  prompt: string
  imageRefs: string[]
  aspectRatio: string
  imageSize: string
}

export function buildGeminiRequest(options: GeminiRequestOptions): { url: string; init: RequestInit } {
  const { baseUrl, model, apiKey, prompt, imageRefs, aspectRatio, imageSize } = options
  const root = baseUrl.replace(/\/+$/, '')
  const mode = resolveGeminiEndpointMode(options.endpointMode, root)

  if (mode === 'native') {
    const nativeRoot = root.replace(/\/v1(?:beta)?$/i, '')
    const url = `${nativeRoot}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
    const parts = [
      ...imageRefs.map((image) => ({ inlineData: { mimeType: 'image/png', data: image.split(',')[1] } })),
      { text: prompt },
    ]
    const isGemini3 = model.includes('gemini-3')
    const imageConfig: Record<string, string> = { aspectRatio }
    if (isGemini3 && imageSize) imageConfig.imageSize = imageSize

    return {
      url,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig },
        }),
      },
    }
  }

  const v1 = /\/v1$/i.test(root) ? root : `${root}/v1`
  if (mode === 'openai_images_edits') {
    if (imageRefs.length > 14) throw new Error('编辑接口最多支持 14 张参考图')
    const body = new FormData()
    body.append('model', model)
    body.append('prompt', prompt)
    body.append('n', '1')
    body.append('response_format', 'url')
    body.append('size', aspectRatio)
    body.append('quality', imageSize.toLowerCase())
    imageRefs.forEach((image, index) => {
      const [header, encoded] = image.split(',')
      const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png'
      const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))
      body.append('image[]', new Blob([bytes], { type: mimeType }), `ref_${index + 1}.png`)
    })
    return {
      url: `${v1}/images/edits`,
      init: {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body,
      },
    }
  }

  if (mode === 'openai_images_generations') {
    return {
      url: `${v1}/images/generations`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          prompt,
          n: 1,
          response_format: 'url',
          size: aspectRatio,
          quality: imageSize.toLowerCase(),
        }),
      },
    }
  }

  const content = [
    { type: 'text', text: `${prompt}\n(Output aspect ratio: ${aspectRatio}, resolution: ${imageSize})` },
    ...imageRefs.map((ref) => ({ type: 'image_url', image_url: { url: ref } })),
  ]
  return {
    url: `${v1}/chat/completions`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content }],
        modalities: ['text', 'image'],
      }),
    },
  }
}
