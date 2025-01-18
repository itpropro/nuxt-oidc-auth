import { fileURLToPath } from 'node:url'
import { url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'

test.use({
  // @ts-expect-error Config overwrite
  nuxt: {
    rootDir: fileURLToPath(new URL('./fixtures/oidcApp', import.meta.url)),
    build: false,
    buildDir: fileURLToPath(new URL('./fixtures/oidcApp/', import.meta.url)),
    nuxtConfig: {
      runtimeConfig: {
        oidc: {
          providers: {
            keycloak: {
              logoutRedirectUri: 'http://localhost:3000',
              clientId: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_ID,
              clientSecret: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_SECRET,
            },
          },
        },
      },
    },
  },
})

test('redirect on logout', async ({ page, goto }) => {
  const provider = 'keycloak'
  const providerUrl = url(`/auth/login`)
  await goto(providerUrl)
  await page.click(`button[name="${provider}"]`)
  await page.fill('input[name="username"]', 'testuser')
  await page.fill('input[name="password"]', 'p@ssword')
  await page.click('input[name="login"]')
  await page.waitForURL(url('/'))
  await page.click('button[name="logout"]')
  expect(page.url()).toMatch(/^http:\/\/localhost:8080/)
})

test('session is cleared on clear', async ({ page, goto }) => {
  const provider = 'keycloak'
  const providerUrl = url(`/auth/login`)
  await goto(providerUrl)
  await page.click(`button[name="${provider}"]`)
  await page.fill('input[name="username"]', 'testuser')
  await page.fill('input[name="password"]', 'p@ssword')
  await page.click('input[name="login"]')
  await page.waitForURL(url('/'))
  await page.click('button[name="clear"]')
  const loggedIn = await page.locator('div[name="loggedIn"]').textContent()
  expect(loggedIn).toBe('false')
  await page.click('button[name="fetch"]')
  expect(loggedIn).toBe('false')
})
