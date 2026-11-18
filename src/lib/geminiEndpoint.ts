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

export function isSeedreamModel(model: string): boolean {
  return /(?:doubao|seedream)/i.test(model)
}

function isGptImage2Model(model: string): boolean {
  return /^gpt-image-2(?:\.\d+)?(?:-|$)/i.test(model.trim())
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

function gptImageOutputSize(aspectRatio: string, imageSize: string): string {
  const requestedLongEdge: Record<string, number> = { '1K': 1024, '2K': 2048, '4K': 3840 }
  const targetLongEdge = requestedLongEdge[imageSize.toUpperCase()]
  const ratio = aspectRatio.match(/^(\d+):(\d+)$/)
  if (!targetLongEdge || !ratio) return 'auto'

  const rawWidth = Number(ratio[1])
  const rawHeight = Number(ratio[2])
  const divisor = gcd(rawWidth, rawHeight)
  const widthRatio = rawWidth / divisor
  const heightRatio = rawHeight / divisor
  const unit = 16
  const maxEdge = 3840
  const minPixels = 655_360
  const maxPixels = 8_294_400
  const pixelsPerStep = widthRatio * heightRatio * unit * unit
  const maxMultiplier = Math.floor(Math.min(
    maxEdge / (Math.max(widthRatio, heightRatio) * unit),
    Math.sqrt(maxPixels / pixelsPerStep),
  ))
  const minMultiplier = Math.ceil(Math.sqrt(minPixels / pixelsPerStep))
  const targetMultiplier = Math.floor(targetLongEdge / (Math.max(widthRatio, heightRatio) * unit))
  const multiplier = Math.max(minMultiplier, Math.min(targetMultiplier, maxMultiplier))
  if (multiplier > maxMultiplier) return 'auto'

  const width = widthRatio * unit * multiplier
  const height = heightRatio * unit * multiplier
  return `${width}x${height}`
}

function imageSizeOptions(model: string, aspectRatio: string, imageSize: string): Record<string, string> {
  if (isGptImage2Model(model)) {
    return { size: gptImageOutputSize(aspectRatio, imageSize) }
  }
  return { size: aspectRatio, quality: imageSize.toLowerCase() }
}

export function resolveGeminiEndpointMode(mode: GeminiEndpointMode, baseUrl: string, model = ''): Exclude<GeminiEndpointMode, 'auto'> {
  // Seedream gateways accept multiple references through the generations
  // payload (`image: [...]`). Sending them through the generic edits
  // multipart adapter can silently drop one of the references.
  if (isSeedreamModel(model) && (mode === 'auto' || mode === 'openai_images_edits')) {
    return 'openai_images_generations'
  }
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
  const mode = resolveGeminiEndpointMode(options.endpointMode, root, model)

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
    const outputOptions = imageSizeOptions(model, aspectRatio, imageSize)
    body.append('size', outputOptions.size)
    if (outputOptions.quality) body.append('quality', outputOptions.quality)
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
    const body: Record<string, unknown> = {
      model,
      prompt,
      n: 1,
      response_format: 'url',
      ...imageSizeOptions(model, aspectRatio, imageSize),
    }
    if (isSeedreamModel(model) && imageRefs.length) body.image = imageRefs
    return {
      url: `${v1}/images/generations`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
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
