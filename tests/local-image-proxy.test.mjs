import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'

test('local proxy forwards GETs for the built-in image origin', async (t) => {
  const server = await createServer({
    cacheDir: 'node_modules/.vite-local-proxy-test',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, ws: false },
  })
  t.after(() => server.close())
  const upstream = 'https://tmp.cangyuansuanli.cn/generated/result.jpg'
  const image = new Uint8Array([255, 216, 255])
  const fetchImage = t.mock.method(globalThis, 'fetch', async (url) => {
    assert.equal(url, upstream)
    return new Response(image, { headers: { 'content-type': 'image/jpeg' } })
  })
  const middleware = server.middlewares.stack.find(({ handle }) => handle.name === 'serve').handle
  const get = (target) => new Promise((resolve, reject) => {
    const response = {
      headers: new Headers(),
      setHeader(key, value) { this.headers.set(key, value) },
      end(body) { resolve(new Response(body, { status: this.statusCode, headers: this.headers })) },
    }
    middleware({ url: '/api/proxy', method: 'GET', headers: { host: 'localhost', 'x-target-url': target } }, response, reject)
  })

  const allowed = await get(upstream)
  assert.equal(allowed.status, 200, await allowed.clone().text())
  assert.equal(allowed.headers.get('content-type'), 'image/jpeg')
  assert.deepEqual(new Uint8Array(await allowed.arrayBuffer()), image)
  assert.equal((await get('https://untrusted.invalid/result.jpg')).status, 403)
  assert.equal(fetchImage.mock.callCount(), 1)
})
