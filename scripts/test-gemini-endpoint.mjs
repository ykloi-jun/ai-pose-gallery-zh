import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const vite = await createServer({
  configFile: false,
  appType: 'custom',
  logLevel: 'error',
  root,
  resolve: { alias: { '@': path.join(root, 'src') } },
  server: { middlewareMode: true },
})

const originalFetch = globalThis.fetch
let capturedRequest
const modelId = 'gemini-3.1-flash-image-preview'

globalThis.fetch = async (input, init = {}) => {
  capturedRequest = {
    url: new URL(typeof input === 'string' ? input : input.url),
    init,
  }
  const response = capturedRequest.url.pathname.endsWith('/images/edits') || capturedRequest.url.pathname.endsWith('/images/generations')
    ? { data: [{ b64_json: 'AA==' }] }
    : capturedRequest.url.pathname.endsWith('/chat/completions')
      ? { choices: [{ message: { images: [{ image_url: { url: 'data:image/png;base64,AA==' } }] } }] }
      : { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AA==' } }] } }] }
  return new Response(JSON.stringify(response), { status: 200, headers: { 'content-type': 'application/json' } })
}

try {
  const { buildRecipePrompt, formatProviderRequestError, generateCharacterImage } = await vite.ssrLoadModule('/src/services/aiGenerator.ts')
  const unsafeProxyResponse = new Response('prompt or image unsafe', { status: 502 })
  const parsedUnsafeResponse = await (await vite.ssrLoadModule('/src/services/aiGenerator.ts')).readJsonResponse(unsafeProxyResponse)
  assert.equal(parsedUnsafeResponse.error.message, 'prompt or image unsafe', 'plain-text gateway safety errors should survive JSON parsing')
  const unsafeMessage = formatProviderRequestError('gemini', 502, 'prompt or image unsafe', {
    pose: { id: 'pose-test', 体系: '全身单人・性感系', 姿势编号: 'P061', 分类: '趴卧', 姿势名称: '背向侧卧・臀部线条', 角度: '俯视', 缩略图: '', 原图: '', 检索: '' },
  })
  assert.ok(unsafeMessage.includes('内容安全审核拒绝'))
  assert.ok(unsafeMessage.includes('背向侧卧・臀部线条'))
  assert.ok(unsafeMessage.includes('更保守的参考图/描述'))
  const timeoutMessage = formatProviderRequestError('gemini', 524, 'upstream timeout', { pose: null })
  assert.ok(timeoutMessage.includes('HTTP 524'))
  assert.ok(timeoutMessage.includes('避免重复计费'))
  const proxyErrorMessage = formatProviderRequestError('gemini', 502, 'fetch failed', { pose: null })
  assert.ok(proxyErrorMessage.includes('本地代理未能取得上游的有效响应'))
  assert.ok(!proxyErrorMessage.includes('内容安全审核'))
  const defaultPrompt = buildRecipePrompt({
    portrait: { source: 'gallery' },
    costume: { source: 'gallery', 服装名称: '测试服装' },
    pose: { source: 'gallery', 姿势名称: '测试姿势', 角度: '正面' },
    extraImages: [],
  })
  assert.ok(defaultPrompt.startsWith('请根据提供的3张参考图，生成一张仅包含一位真实人物的完整照片。'))
  assert.ok(defaultPrompt.includes('参考名称：**测试服装**'))
  assert.ok(defaultPrompt.includes('还原**测试姿势，正面**的姿势'))
  assert.ok(defaultPrompt.includes('### 5. 摄影风格与画面要求'))
  assert.ok(defaultPrompt.includes('**负面提示词（工具支持独立负面提示词栏时使用）：**'))
  assert.ok(!defaultPrompt.includes('\\n'), 'prompt should contain real line breaks')
  const { migrateGeminiEndpointMode, resolveGeminiEndpointMode } = await vite.ssrLoadModule('/src/lib/geminiEndpoint.ts')
  // A legacy native-mode config pointed to an OpenAI-compatible /v1 gateway.
  const migratedMode = migrateGeminiEndpointMode('native', 'https://api.bblabu.ai/v1')
  assert.equal(migratedMode, 'auto', 'legacy native settings should migrate to automatic protocol selection')
  assert.equal(resolveGeminiEndpointMode('auto', 'https://generativelanguage.googleapis.com'), 'native', 'official Gemini endpoints should retain native mode')
  assert.equal(resolveGeminiEndpointMode('auto', 'https://api.bblabu.ai/v1'), 'openai_images_edits', 'image-only /v1 gateways should select image edits')
  assert.equal(resolveGeminiEndpointMode('native', 'https://api.bblabu.ai/v1'), 'native', 'manual native mode should override automatic detection')
  assert.equal(resolveGeminiEndpointMode('openai_chat', 'https://generativelanguage.googleapis.com'), 'openai_chat', 'manual OpenAI Chat mode should override automatic detection')
  const result = await generateCharacterImage({
    recipe: { portrait: null, costume: null, pose: null, extraImages: [{ url: 'data:image/png;base64,AA==' }] },
    prompt: 'test prompt',
    config: {
      activeProvider: 'gemini',
      imagePassMode: 'base64',
      useProxy: false,
      stylePreset: 'realistic',
      sendStitchedSheet: false,
      providers: {
        gemini: { baseUrl: 'https://api.bblabu.ai/v1', apiKey: 'test-key', model: modelId, customModel: '' },
      },
      geminiParams: { endpointMode: migratedMode, aspectRatio: '3:4', imageSize: '2K' },
    },
  })

  assert.ok(capturedRequest, 'generation should make a request')
  assert.equal(capturedRequest.url.pathname, '/v1/images/edits', 'image-only /v1 gateways should receive image-edit requests')
  assert.ok(capturedRequest.init.body instanceof FormData, 'image edits should use multipart form data')
  assert.equal(capturedRequest.init.body.get('model'), modelId)
  assert.equal(capturedRequest.init.body.get('n'), '1')
  assert.equal(capturedRequest.init.body.get('response_format'), 'url')
  assert.equal(capturedRequest.init.body.get('size'), '3:4')
  assert.equal(capturedRequest.init.body.get('quality'), '2k')
  assert.equal(capturedRequest.init.body.getAll('image[]').length, 1)
  assert.equal(result.modelUsed, modelId)

  await generateCharacterImage({
    recipe: { portrait: null, costume: null, pose: null, extraImages: [{ url: 'data:image/png;base64,AA==' }] },
    prompt: 'test prompt',
    config: {
      activeProvider: 'gemini',
      imagePassMode: 'base64',
      useProxy: false,
      stylePreset: 'realistic',
      sendStitchedSheet: false,
      providers: {
        gemini: { baseUrl: 'https://generativelanguage.googleapis.com', apiKey: 'test-key', model: modelId, customModel: '' },
      },
      geminiParams: { endpointMode: 'auto', aspectRatio: '3:4', imageSize: '2K' },
    },
  })
  assert.equal(capturedRequest.url.pathname, '/v1beta/models/' + modelId + ':generateContent', 'automatic mode should retain native Gemini for Google endpoints')

  const textOnlyResult = await generateCharacterImage({
    recipe: { portrait: null, costume: null, pose: null, extraImages: [] },
    prompt: 'test prompt',
    config: {
      activeProvider: 'gemini',
      imagePassMode: 'base64',
      useProxy: false,
      stylePreset: 'realistic',
      sendStitchedSheet: false,
      providers: {
        gemini: { baseUrl: 'https://api.bblabu.ai/v1', apiKey: 'test-key', model: modelId, customModel: '' },
      },
      geminiParams: { endpointMode: 'openai_images_generations', aspectRatio: '9:16', imageSize: '2K' },
    },
  })
  assert.equal(capturedRequest.url.pathname, '/v1/images/generations', 'text-only generation should use the generations endpoint')
  assert.deepEqual(JSON.parse(capturedRequest.init.body), {
    model: modelId,
    prompt: 'test prompt',
    n: 1,
    response_format: 'url',
    size: '9:16',
    quality: '2k',
  }, 'generation request should include the selected aspect ratio and image size')
  assert.equal(textOnlyResult.modelUsed, modelId)

  const { durableImage } = await vite.ssrLoadModule('/src/lib/persistentImages.ts')
  const upstreamImageUrl = 'https://tmp.cangyuansuanli.cn/gen-images/test/result.jpg'
  const generatorFetch = globalThis.fetch
  const originalFileReader = globalThis.FileReader
  class TestFileReader {
    result = null
    onload = null
    onerror = null
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = 'data:' + blob.type + ';base64,' + Buffer.from(buffer).toString('base64')
        this.onload?.()
      }, () => this.onerror?.())
    }
  }
  globalThis.FileReader = TestFileReader
  globalThis.fetch = async (input, init = {}) => {
    if (input === upstreamImageUrl) throw new TypeError('Failed to fetch')
    assert.equal(input, '/api/proxy', 'CORS failures should retry through the same-origin image proxy')
    assert.equal(init.method, 'GET')
    assert.equal(new Headers(init.headers).get('x-target-url'), upstreamImageUrl)
    return new Response(new Uint8Array([255, 216, 255]), { status: 200, headers: { 'content-type': 'image/jpeg' } })
  }
  try {
    assert.equal(await durableImage(upstreamImageUrl), 'data:image/jpeg;base64,/9j/')
  } finally {
    globalThis.fetch = generatorFetch
    globalThis.FileReader = originalFileReader
  }

  const { onRequestGet } = await vite.ssrLoadModule('/functions/api/proxy.ts')
  const imageProxyFetch = globalThis.fetch
  let serverFetchUrl
  globalThis.fetch = async (input) => {
    serverFetchUrl = String(input)
    return new Response(new Uint8Array([255, 216, 255]), { status: 200, headers: { 'content-type': 'image/jpeg' } })
  }
  try {
    const proxyRequest = new Request('https://local.test/api/proxy', {
      method: 'GET',
      headers: { 'x-target-url': upstreamImageUrl },
    })
    const proxyResponse = await onRequestGet({ request: proxyRequest })
    assert.equal(serverFetchUrl, upstreamImageUrl)
    assert.equal(proxyResponse.status, 200)
    assert.equal(proxyResponse.headers.get('content-type'), 'image/jpeg')
    assert.deepEqual([...new Uint8Array(await proxyResponse.arrayBuffer())], [255, 216, 255])

    const denied = await onRequestGet({
      request: new Request('https://local.test/api/proxy', {
        method: 'GET',
        headers: { 'x-target-url': 'https://untrusted.invalid/image.jpg' },
      }),
    })
    assert.equal(denied.status, 403, 'the image proxy must reject unapproved origins')
  } finally {
    globalThis.fetch = imageProxyFetch
  }

  const { onRequestPromptEnhance } = await vite.ssrLoadModule('/functions/api/promptEnhance.ts')
  const originalEnhanceFetch = globalThis.fetch
  let enhancementRequest
  globalThis.fetch = async (input, init = {}) => {
    enhancementRequest = { url: new URL(String(input)), init }
    return new Response(JSON.stringify({ choices: [{ message: { content: '增强后的测试提示词' } }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    const enhanceResponse = await onRequestPromptEnhance({
      request: new Request('https://local.test/api/prompt-enhance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'test-enhancer-key',
          model: 'gpt-4o-mini',
          basePrompt: '基础角色提示词',
          referenceContext: '人像身份参考：短发；服装参考：蓝色大衣',
          stylePreset: '写实人像写真',
        }),
      }),
    })
    assert.equal(enhanceResponse.status, 200)
    assert.deepEqual(await enhanceResponse.json(), { prompt: '增强后的测试提示词' })
    assert.equal(enhancementRequest.url.href, 'https://api.openai.com/v1/chat/completions')
    assert.equal(new Headers(enhancementRequest.init.headers).get('authorization'), 'Bearer test-enhancer-key')
    const enhanceBody = JSON.parse(enhancementRequest.init.body)
    assert.equal(enhanceBody.model, 'gpt-4o-mini')
    assert.ok(enhanceBody.messages[1].content.includes('基础角色提示词'))
    assert.ok(enhanceBody.messages[1].content.includes('人像身份参考：短发'))

    let untrustedFetchCalled = false
    globalThis.fetch = async () => {
      untrustedFetchCalled = true
      throw new Error('Untrusted endpoint should never be called')
    }
    const deniedEnhance = await onRequestPromptEnhance({
      request: new Request('https://local.test/api/prompt-enhance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          baseUrl: 'https://untrusted.invalid/v1',
          apiKey: 'test-key',
          model: 'test-model',
          basePrompt: 'test',
        }),
      }),
    })
    assert.equal(deniedEnhance.status, 403)
    assert.equal(untrustedFetchCalled, false, 'the server must reject unapproved API origins before fetching')

    const originalAbortTimeout = AbortSignal.timeout
    let timeoutDuration
    AbortSignal.timeout = (milliseconds) => {
      timeoutDuration = milliseconds
      return AbortSignal.abort(new DOMException('Timed out', 'TimeoutError'))
    }
    globalThis.fetch = async (_input, init = {}) => {
      if (init.signal.aborted) throw init.signal.reason
      throw new Error('The timeout signal should already be aborted')
    }
    try {
      const timeoutResponse = await onRequestPromptEnhance({
        request: new Request('https://local.test/api/prompt-enhance', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            baseUrl: 'https://api.openai.com/v1',
            apiKey: 'test-key',
            model: 'gpt-4o-mini',
            basePrompt: 'test prompt',
          }),
        }),
      })
      assert.equal(timeoutDuration, 300_000, 'prompt enhancement should allow the model up to 300 seconds')
      assert.equal(timeoutResponse.status, 502)
      assert.match((await timeoutResponse.json()).error.message, /300 秒/)
    } finally {
      AbortSignal.timeout = originalAbortTimeout
    }
  } finally {
    globalThis.fetch = originalEnhanceFetch
  }

  console.log('PASS: provider safety, timeout, proxy errors, and gateway response parsing are distinguished.')
} finally {
  globalThis.fetch = originalFetch
  await vite.close()
}
