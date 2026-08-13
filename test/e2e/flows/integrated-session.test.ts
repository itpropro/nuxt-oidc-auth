import { once } from 'node:events'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'

let tokenRequestCount = 0
let userInfoAvailable = true
let lastLogoutRedirect: string | null = null
let blockedTokenRequest: Promise<void> | undefined
let tokenRequestStarted: (() => void) | undefined
const appOrigin = 'http://127.0.0.1:31840'
const logoutRedirectTarget = `${appOrigin}/excluded?next=one&value=two#resume path`
const expectedLogoutRedirect = new URL(logoutRedirectTarget).toString()

function jwt(payload: Record<string, unknown>): string {
  const encodedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
    'base64url',
  )
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encodedHeader}.${encodedPayload}.signature`
}

function tokenResponse(requestIndex: number) {
  const now = Math.trunc(Date.now() / 1000)
  const identity = requestIndex >= 3 ? 'second-user' : 'first-user'
  const role = requestIndex === 1 ? 'admin-role' : 'user-role'

  return {
    access_token: jwt({ sub: identity, preferred_username: identity, iat: now, exp: now + 3600 }),
    id_token: jwt({
      sub: identity,
      iat: now,
      exp: now + 3600,
      resource_access: { playground: { roles: [role] } },
    }),
    refresh_token: `refresh-token-${requestIndex}`,
    token_type: 'Bearer',
    expires_in: 3600,
  }
}

const provider = createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host}`)

  if (requestUrl.pathname === '/authorize') {
    const redirectUri = requestUrl.searchParams.get('redirect_uri')
    const state = requestUrl.searchParams.get('state')
    if (!redirectUri || !state) {
      response.writeHead(400).end()
      return
    }

    const callback = new URL(redirectUri)
    callback.searchParams.set('code', `code-${tokenRequestCount + 1}`)
    callback.searchParams.set('state', state)
    response.writeHead(302, { location: callback.toString() }).end()
    return
  }

  if (requestUrl.pathname === '/token') {
    tokenRequestCount += 1
    if (blockedTokenRequest) {
      const release = blockedTokenRequest
      blockedTokenRequest = undefined
      tokenRequestStarted?.()
      await release
    }
    userInfoAvailable = tokenRequestCount < 3
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(tokenResponse(tokenRequestCount)))
    return
  }

  if (requestUrl.pathname === '/userinfo') {
    if (!userInfoAvailable) {
      response.writeHead(404, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'not_found' }))
      return
    }

    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ displayName: 'First User' }))
    return
  }

  if (requestUrl.pathname === '/logout') {
    lastLogoutRedirect = requestUrl.searchParams.get('post_logout_redirect_uri')
    response.writeHead(302, { location: expectedLogoutRedirect }).end()
    return
  }

  response.writeHead(404).end()
})

provider.listen(0, '127.0.0.1')
await once(provider, 'listening')
const providerAddress = provider.address()
if (!providerAddress || typeof providerAddress === 'string') {
  throw new Error('Mock provider did not bind a TCP port')
}
const providerOrigin = `http://127.0.0.1:${providerAddress.port}`

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/oidcApp', import.meta.url)),
    build: true,
    port: 31840,
    env: {
      NUXT_OIDC_AUTH_SESSION_SECRET: 'test-auth-session-secret-at-least-48-characters-long',
      NUXT_OIDC_SESSION_SECRET: 'test-user-session-secret-at-least-48-characters-long',
      NUXT_OIDC_TOKEN_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    },
    nuxtConfig: {
      oidc: {
        defaultProvider: 'oidc',
        providers: {
          oidc: {
            clientId: 'browser-client',
            clientSecret: 'browser-secret',
            authorizationUrl: `${providerOrigin}/authorize`,
            tokenUrl: `${providerOrigin}/token`,
            userInfoUrl: `${providerOrigin}/userinfo`,
            logoutUrl: `${providerOrigin}/logout`,
            logoutRedirectParameterName: 'post_logout_redirect_uri',
            redirectUri: `${appOrigin}/auth/oidc/callback`,
            allowedCallbackRedirectUrls: [appOrigin],
            optionalClaims: ['resource_access'],
            userNameClaim: 'preferred_username',
            tokenRequestType: 'form-urlencoded',
            pkce: false,
            nonce: false,
            validateAccessToken: false,
            validateIdToken: false,
            sessionConfiguration: {
              singleSignOut: false,
              expirationCheck: false,
            },
          },
        },
        middleware: {
          globalMiddlewareEnabled: false,
          customLoginPage: true,
        },
      },
    },
  },
})

test.afterAll(async () => {
  provider.close()
  await once(provider, 'close')
})

test('preserves current session data across integrated browser flows', async ({ page, goto }) => {
  tokenRequestCount = 0
  userInfoAvailable = true
  lastLogoutRedirect = null
  blockedTokenRequest = undefined
  tokenRequestStarted = undefined

  await goto(url('/auth/login'))
  await page.click('button[name="oidc"]')
  await page.waitForURL(url('/'))

  await expect(page.locator('div[name="userName"]')).toHaveText('first-user')
  await expect(page.locator('div[name="claims"]')).toContainText('admin-role')
  await expect(page.locator('div[name="userInfo"]')).toContainText('First User')

  await page.context().request.post(url('/api/test/session-stale'))
  await page.click('button[name="refresh"]')
  await expect(page.locator('div[name="claims"]')).toContainText('user-role')
  await expect(page.locator('div[name="claims"]')).not.toContainText('admin-role')

  await goto(url('/auth/login'))
  let releaseTokenRequest: () => void = () => {}
  const tokenRequestReached = new Promise<void>((resolve) => {
    tokenRequestStarted = resolve
  })
  blockedTokenRequest = new Promise<void>((resolve) => {
    releaseTokenRequest = resolve
  })

  await page.click('button[name="oidc"]', { noWaitAfter: true })
  await tokenRequestReached

  let staleTab: Page | undefined
  try {
    staleTab = await page.context().newPage()
    await staleTab.goto(url('/auth/oidc/callback'))
    await expect(staleTab.locator('div[name="loggedIn"]')).toHaveText('true')
  } finally {
    releaseTokenRequest()
    await staleTab?.close()
  }
  await page.waitForURL(url('/'))

  await expect(page.locator('div[name="userName"]')).toHaveText('second-user')
  await expect(page.locator('div[name="userInfo"]')).toHaveText('')

  await page.goto(
    `${url('/auth/oidc/logout')}?logoutRedirectUri=${encodeURIComponent(logoutRedirectTarget)}`,
  )

  expect(lastLogoutRedirect).toBe(logoutRedirectTarget)
  expect(page.url()).toBe(expectedLogoutRedirect)
})
