import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, watch: null, ws: false },
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
})
after(() => server.close())
const { fetchRelayModels, relayModelIds } = await server.ssrLoadModule('/src/services/relay.ts')
const { DEFAULT_API_CONFIG, mergeStoredConfig } = await server.ssrLoadModule('/src/store/studioConfig.ts')
const { generateCharacterImage } = await server.ssrLoadModule('/src/services/aiGenerator.ts')
const { onRequestGet } = await server.ssrLoadModule('/functions/api/proxy.ts')

const baseUrl = 'https://relay.test/api/v1/'
const apiKey = 'test-key'
const image = 'data:image/png;base64,AA=='

test('relay model discovery uses GET and forwards authorization only to allowlisted origins', async (t) => {
  let upstreamRequests = 0
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (url === '/api/proxy') {
      return onRequestGet({
        request: new Request('https://gallery.test/api/proxy', init),
        env: { PROXY_ALLOWED_ORIGINS: 'https://relay.test' },
      })
    }
    upstreamRequests++
    assert.equal(url, 'https://relay.test/api/v1/models')
    assert.equal(init.method, 'GET')
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer test-key')
    return Response.json({ data: [{ id: ' example/image ' }, { id: 'example/image' }, { id: 42 }, null] })
  })
  assert.deepEqual(await fetchRelayModels({ baseUrl, apiKey }, false), ['example/image'])
  assert.deepEqual(await fetchRelayModels({ baseUrl, apiKey }, true), ['example/image'])
  await assert.rejects(fetchRelayModels({ baseUrl: 'https://unlisted.test', apiKey }, true), /PROXY_ALLOWED_ORIGINS/)
  assert.equal(upstreamRequests, 2)
})

test('legacy config gains a relay entry and a reload restores the chosen model and both lists', () => {
  const legacy = structuredClone(DEFAULT_API_CONFIG)
  delete legacy.providers.relay
  delete legacy.relayEndpointMode
  assert.deepEqual(mergeStoredConfig(legacy).providers.relay, DEFAULT_API_CONFIG.providers.relay)
  assert.equal(mergeStoredConfig({ relayParams: { quality: 'high' } }).relayParams.quality, '2k')
  assert.equal(mergeStoredConfig({ relayParams: { quality: 'low' } }).relayParams.quality, '1k')
  assert.equal(mergeStoredConfig({ relayParams: { quality: 'max' } }).relayParams.quality, '4k')
  for (const aspectRatio of ['auto', '2:3', '3:4', '4:5', '9:16', '1:1', '5:4', '4:3', '3:2', '16:9', '21:9']) {
    assert.equal(
      mergeStoredConfig({ relayParams: { aspectRatio } }).relayParams.aspectRatio,
      aspectRatio,
    )
  }

  const stored = structuredClone(DEFAULT_API_CONFIG)
  stored.activeProvider = 'relay'
  stored.relayEndpointMode = 'chat'
  Object.assign(stored.providers.relay, {
    baseUrl, apiKey, model: 'custom', useProxy: true,
    fetchedModels: ['example/image', 'custom'], manualModels: ['custom', 'example/manual'],
  })
  const restored = mergeStoredConfig(JSON.parse(JSON.stringify(stored)))
  assert.equal(restored.activeProvider, 'relay')
  assert.equal(restored.relayEndpointMode, 'chat')
  assert.deepEqual(restored.providers.relay, stored.providers.relay)
  assert.deepEqual(relayModelIds(restored.providers.relay), ['custom', 'example/manual', 'example/image'])
})

for (const mode of ['images_edits_json', 'images_edits', 'chat']) {
  test(`${mode} sends the selected relay model ID with the reference image`, async (t) => {
    const config = structuredClone(DEFAULT_API_CONFIG)
    config.activeProvider = 'relay'
    config.relayEndpointMode = mode
    Object.assign(config.providers.relay, { baseUrl: 'https://relay.test', apiKey, model: 'custom', manualModels: ['custom'], useProxy: mode === 'chat' })
    Object.assign(config.relayParams, {
      aspectRatio: '21:9', quality: '2k', inputFidelity: 'low',
      background: 'transparent', outputFormat: 'webp', moderation: 'low',
    })
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      const headers = new Headers(init.headers)
      const target = mode === 'chat' ? headers.get('x-target-url') : url
      assert.equal(target, `https://relay.test/v1/${mode === 'chat' ? 'chat/completions' : 'images/edits'}`)
      assert.equal(url, mode === 'chat' ? '/api/proxy' : target)
      assert.equal(headers.get('Authorization'), `Bearer ${apiKey}`)
      assert.equal(init.method, 'POST')
      if (mode === 'images_edits') {
        assert.equal(init.body.get('model'), 'custom')
        assert.equal(init.body.get('image[]').type, 'image/png')
        assert.equal(init.body.get('size'), '21:9')
        assert.equal(init.body.has('aspect_ratio'), false)
        assert.equal(init.body.get('quality'), '2k')
        assert.equal(init.body.get('input_fidelity'), 'low')
        assert.equal(init.body.get('background'), 'transparent')
        assert.equal(init.body.get('output_format'), 'webp')
        assert.equal(init.body.get('moderation'), 'low')
      } else {
        const request = JSON.parse(init.body)
        assert.equal(request.model, 'custom')
        assert.equal(mode === 'chat' ? request.messages[0].content[1].image_url.url : request.images[0].image_url, image)
        if (mode === 'images_edits_json') {
          assert.equal(request.size, '21:9')
          assert.equal(Object.hasOwn(request, 'aspect_ratio'), false)
          assert.equal(request.quality, '2k')
          assert.equal(request.input_fidelity, 'low')
          assert.equal(request.background, 'transparent')
          assert.equal(request.output_format, 'webp')
          assert.equal(request.moderation, 'low')
        } else {
          for (const field of ['aspect_ratio', 'quality', 'input_fidelity', 'background', 'output_format', 'moderation']) assert.equal(Object.hasOwn(request, field), false)
        }
      }
      return Response.json({ data: [{ b64_json: 'AA==' }] })
    })
    const result = await generateCharacterImage({
      recipe: { portrait: null, costume: null, pose: null, extraImages: [{ url: image, name: 'reference' }] },
      prompt: 'Draw from the reference.', config,
    })
    assert.deepEqual(result, { imageUrl: mode === 'chat' ? image : 'data:image/webp;base64,AA==', modelUsed: 'custom', providerUsed: 'relay' })
  })
}
