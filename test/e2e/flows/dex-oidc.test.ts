import { fileURLToPath } from 'node:url'
import { expect, test } from '@nuxt/test-utils/playwright'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/oidcApp', import.meta.url)),
    build: true,
    port: 3000,
    env: {
      NUXT_OIDC_AUTH_SESSION_SECRET: 'test-auth-session-secret-at-least-48-characters-long',
      NUXT_OIDC_DEFAULT_PROVIDER: 'oidc',
      NUXT_OIDC_PROVIDERS_OIDC_AUDIENCE: 'nuxt-oidc-test',
      NUXT_OIDC_PROVIDERS_OIDC_AUTHORIZATION_URL: 'http://127.0.0.1:5556/dex/auth/mock',
      NUXT_OIDC_PROVIDERS_OIDC_CLIENT_ID: 'nuxt-oidc-test',
      NUXT_OIDC_PROVIDERS_OIDC_CLIENT_SECRET: 'nuxt-oidc-test-secret',
      NUXT_OIDC_PROVIDERS_OIDC_REDIRECT_URI: 'http://localhost:3000/auth/oidc/callback',
      NUXT_OIDC_PROVIDERS_OIDC_TOKEN_URL: 'http://127.0.0.1:5556/dex/token',
      NUXT_OIDC_PROVIDERS_OIDC_USER_INFO_URL: 'http://127.0.0.1:5556/dex/userinfo',
      NUXT_OIDC_SESSION_SECRET: 'test-user-session-secret-at-least-48-characters-long',
      NUXT_OIDC_TOKEN_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    },
  },
})

test('completes a validated generic OIDC session and refresh against dex', async ({ page }) => {
  await page.goto('http://localhost:3000/auth/login')
  await page.click('button[name="oidc"]')
  await page.waitForURL('http://localhost:3000/')

  await expect(page.locator('div[name="loggedIn"]')).toHaveText('true')
  await expect(page.locator('div[name="currentProvider"]')).toHaveText('oidc')
  await expect(page.locator('div[name="userName"]')).toHaveText('Kilgore Trout')
  await expect(page.locator('div[name="userInfo"]')).toContainText('kilgore@kilgore.trout')
  await expect(page.locator('div[name="canRefresh"]')).toHaveText('true')

  const refreshResponse = await page
    .context()
    .request.post('http://localhost:3000/api/_auth/refresh')
  expect(refreshResponse.ok()).toBe(true)

  await page.reload()
  await expect(page.locator('div[name="loggedIn"]')).toHaveText('true')
})
