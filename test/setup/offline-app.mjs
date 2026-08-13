import { spawn } from 'node:child_process'
import { createServer } from 'node:http'

const appEntry = 'test/fixtures/oidcApp/.output/server/index.mjs'
const faultEnvironment = {
  NUXT_OIDC_PROVIDERS_OIDC_AUTHORIZATION_URL: 'http://127.0.0.1:5557/authorize',
  NUXT_OIDC_PROVIDERS_OIDC_CLIENT_ID: 'browser-client',
  NUXT_OIDC_PROVIDERS_OIDC_CLIENT_SECRET: 'browser-secret',
  NUXT_OIDC_PROVIDERS_OIDC_LOGOUT_URL: 'http://127.0.0.1:5557/logout',
  NUXT_OIDC_PROVIDERS_OIDC_NONCE: 'false',
  NUXT_OIDC_PROVIDERS_OIDC_PKCE: 'false',
  NUXT_OIDC_PROVIDERS_OIDC_REDIRECT_URI: 'http://localhost:31840/auth/oidc/callback',
  NUXT_OIDC_PROVIDERS_OIDC_TOKEN_URL: 'http://127.0.0.1:5557/token',
  NUXT_OIDC_PROVIDERS_OIDC_TOKEN_VALIDATION_MODE: 'legacy',
  NUXT_OIDC_PROVIDERS_OIDC_USER_INFO_URL: 'http://127.0.0.1:5557/userinfo',
  NUXT_OIDC_PROVIDERS_OIDC_VALIDATE_ACCESS_TOKEN: 'false',
  NUXT_OIDC_PROVIDERS_OIDC_VALIDATE_ID_TOKEN: 'false',
}

let appProcess
let switching = false

function startApp(environment = {}) {
  appProcess = spawn(process.execPath, [appEntry], {
    env: { ...process.env, ...environment },
    stdio: 'inherit',
  })
  appProcess.once('exit', (code, signal) => {
    if (!switching && code !== 0) {
      console.error(`Offline app stopped unexpectedly (${signal || code})`)
      process.exitCode = code || 1
    }
  })
}

async function stopApp() {
  if (appProcess?.exitCode !== null || appProcess.signalCode !== null) return
  switching = true
  appProcess.kill('SIGTERM')
  await new Promise((resolve) => appProcess.once('exit', resolve))
  switching = false
}

async function waitForApp() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:31840/auth/login', {
        redirect: 'manual',
      })
      if (response.status < 500) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error('Offline app did not become ready')
}

startApp()

const controlServer = createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url !== '/fault') {
    response.writeHead(404).end()
    return
  }

  try {
    await stopApp()
    startApp(faultEnvironment)
    await waitForApp()
    response.writeHead(204).end()
  } catch (error) {
    console.error(error)
    response.writeHead(500).end()
  }
})

controlServer.listen(31841, '127.0.0.1')

async function shutdown() {
  controlServer.close()
  await stopApp()
  process.exit()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
