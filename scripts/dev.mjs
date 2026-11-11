import { spawn } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'

const localProxyHost = '127.0.0.1'
const localProxyPort = Number(process.env.LOCAL_DEV_PROXY_PORT || 17890)
const proxyVariables = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy']

function hasProxyEnvironment() {
  return proxyVariables.some((name) => Boolean(process.env[name]?.trim()))
}

function isLocalProxyAvailable(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    const finish = (available) => {
      socket.destroy()
      resolve(available)
    }
    socket.setTimeout(400, () => finish(false))
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
  })
}

if (hasProxyEnvironment()) {
  const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy
  const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy || process.env.HTTPS_PROXY || process.env.https_proxy
  process.env.HTTPS_PROXY ||= httpsProxy
  process.env.HTTP_PROXY ||= httpProxy
  process.env.NO_PROXY ||= process.env.no_proxy || 'localhost,127.0.0.1,::1'
} else if (Number.isInteger(localProxyPort) && localProxyPort > 0 && await isLocalProxyAvailable(localProxyHost, localProxyPort)) {
  const proxyUrl = `http://${localProxyHost}:${localProxyPort}`
  process.env.HTTP_PROXY = proxyUrl
  process.env.HTTPS_PROXY = proxyUrl
  process.env.NO_PROXY ||= 'localhost,127.0.0.1,::1'
  console.log('Using the available local proxy for development requests.')
}

const viteEntry = path.resolve('node_modules/vite/bin/vite.js')
const vite = spawn(process.execPath, ['--use-env-proxy', viteEntry, ...process.argv.slice(2)], {
  env: process.env,
  stdio: 'inherit',
})

vite.once('error', (error) => {
  console.error(`Unable to start Vite: ${error.message}`)
  process.exitCode = 1
})
vite.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0)
})