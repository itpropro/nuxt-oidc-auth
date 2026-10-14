import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'

const appEntry = 'test/fixtures/oidcApp/.output/server/index.mjs'
const faultEnvironment = {
  NUXT_OIDC_PROVIDERS_OIDC_AUDIENCE: 'browser-api',
  NUXT_OIDC_PROVIDERS_OIDC_AUTHORIZATION_URL: 'http://127.0.0.1:5557/authorize',
  NUXT_OIDC_PROVIDERS_OIDC_CLIENT_ID: 'browser-client',
  NUXT_OIDC_PROVIDERS_OIDC_CLIENT_SECRET: 'browser-secret',
  NUXT_OIDC_PROVIDERS_OIDC_LOGOUT_URL: 'http://127.0.0.1:5557/logout',
  NUXT_OIDC_PROVIDERS_OIDC_NONCE: 'true',
  NUXT_OIDC_PROVIDERS_OIDC_OPEN_ID_CONFIGURATION:
    'http://127.0.0.1:5557/.well-known/openid-configuration',
  NUXT_OIDC_PROVIDERS_OIDC_PKCE: 'false',
  NUXT_OIDC_PROVIDERS_OIDC_REDIRECT_URI: 'http://localhost:31840/auth/oidc/callback',
  NUXT_OIDC_PROVIDERS_OIDC_TOKEN_URL: 'http://127.0.0.1:5557/token',
  NUXT_OIDC_PROVIDERS_OIDC_TOKEN_VALIDATION_MODE: 'strict',
  NUXT_OIDC_PROVIDERS_OIDC_USER_INFO_URL: 'http://127.0.0.1:5557/userinfo',
  NUXT_OIDC_PROVIDERS_OIDC_VALIDATE_ACCESS_TOKEN: 'true',
  NUXT_OIDC_PROVIDERS_OIDC_VALIDATE_ID_TOKEN: 'true',
}

/** @type {import('node:child_process').ChildProcess | undefined} */
let appProcess
let switching = false

function startApp(environment = {}) {
  appProcess = spawn(process.execPath, [appEntry], {
    env: { ...process.env, ...environment },
    stdio: 'inherit',
  })
  appProcess.once('exit', (code, signal) => {
    if (!switching && code !== 0) {
      console.error(`Offline app stopped unexpectedly (${signal ?? code})`)
      process.exitCode = code === null || code === 0 ? 1 : code
    }
  })
}

async function stopApp() {
  if (appProcess === undefined || appProcess.exitCode !== null || appProcess.signalCode !== null) {
    return
  }
  switching = true
  appProcess.kill('SIGTERM')
  await once(appProcess, 'exit')
  switching = false
}

async function waitForApp() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      // oxlint-disable-next-line no-await-in-loop -- Readiness checks must run in order before the next bounded retry.
      const response = await fetch('http://127.0.0.1:31840/auth/login', {
        redirect: 'manual',
      })
      if (response.status < 500) {
        return
      }
    } catch {
      // The app may not accept connections until startup completes.
    }
    // oxlint-disable-next-line no-await-in-loop -- Keep the 50 ms interval between readiness checks.
    await delay(50)
  }
  throw new Error('Offline app did not become ready')
}

startApp()

/**
 * @param {import('node:http').IncomingMessage} request
 * @param {import('node:http').ServerResponse} response
 */
async function handleControlRequest(request, response) {
  if (request.method !== 'POST' || (request.url !== '/dex' && request.url !== '/fault')) {
    response.writeHead(404).end()
    return
  }

  try {
    await stopApp()
    startApp(request.url === '/fault' ? faultEnvironment : {})
    await waitForApp()
    response.writeHead(204).end()
  } catch (error) {
    console.error(error)
    response.writeHead(500).end()
  }
}

const controlServer = createServer((request, response) => {
  void handleControlRequest(request, response)
})

controlServer.listen(31841, '127.0.0.1')

async function shutdown() {
  controlServer.close()
  await stopApp()
  process.exit()
}

process.once('SIGINT', () => {
  void shutdown()
})
process.once('SIGTERM', () => {
  void shutdown()
})
