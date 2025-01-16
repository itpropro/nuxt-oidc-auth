import { fileURLToPath } from 'node:url'
import { url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'

test.use({
  // @ts-expect-error Config overwrite
  nuxt: {
    rootDir: fileURLToPath(new URL('./fixtures/customLogin', import.meta.url)),
    nuxtConfig: {
      runtimeConfig: {
        oidc: {
          providers: {
            keycloak: {
              logoutRedirectUri: 'http://localhost:3000',
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
  await page.waitForURL(url('/'))
})

test('redirect on clear', async ({ page, goto }) => {
  const provider = 'keycloak'
  const providerUrl = url(`/auth/login`)
  await goto(providerUrl)
  await page.click(`button[name="${provider}"]`)
  await page.fill('input[name="username"]', 'testuser')
  await page.fill('input[name="password"]', 'p@ssword')
  await page.click('input[name="login"]')
  await page.waitForURL(url('/'))
  await page.click('button[name="clear"]')
  await page.waitForURL(url('/'))
})
