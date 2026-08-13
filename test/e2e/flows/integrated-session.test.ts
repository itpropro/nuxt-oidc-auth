import { fileURLToPath } from 'node:url'
import { url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'
import { startFaultOidcProvider } from '../../setup/fault-oidc-provider'

const appOrigin = 'http://127.0.0.1:31840'
const logoutRedirectTarget = `${appOrigin}/excluded?next=one&value=two#resume path`
const expectedLogoutRedirect = new URL(logoutRedirectTarget).toString()
const provider = await startFaultOidcProvider(expectedLogoutRedirect)

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/oidcApp', import.meta.url)),
    build: true,
    port: 31840,
    env: {
      NUXT_OIDC_AUTH_SESSION_SECRET: 'test-auth-session-secret-at-least-48-characters-long',
      NUXT_OIDC_DEFAULT_PROVIDER: 'oidc',
      NUXT_OIDC_PROVIDERS_OIDC_AUTHORIZATION_URL: `${provider.origin}/authorize`,
      NUXT_OIDC_PROVIDERS_OIDC_CLIENT_ID: 'browser-client',
      NUXT_OIDC_PROVIDERS_OIDC_CLIENT_SECRET: 'browser-secret',
      NUXT_OIDC_PROVIDERS_OIDC_LOGOUT_URL: `${provider.origin}/logout`,
      NUXT_OIDC_PROVIDERS_OIDC_REDIRECT_URI: `${appOrigin}/auth/oidc/callback`,
      NUXT_OIDC_PROVIDERS_OIDC_TOKEN_URL: `${provider.origin}/token`,
      NUXT_OIDC_PROVIDERS_OIDC_USER_INFO_URL: `${provider.origin}/userinfo`,
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
            authorizationUrl: `${provider.origin}/authorize`,
            tokenUrl: `${provider.origin}/token`,
            userInfoUrl: `${provider.origin}/userinfo`,
            logoutUrl: `${provider.origin}/logout`,
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
  await provider.close()
})

test('preserves current session data across integrated browser flows', async ({ page, goto }) => {
  provider.reset()

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
  const { releaseTokenRequest, tokenRequestReached } = provider.blockNextTokenRequest()

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

  expect(provider.getLastLogoutRedirect()).toBe(logoutRedirectTarget)
  expect(page.url()).toBe(expectedLogoutRedirect)
})
