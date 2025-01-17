import { fileURLToPath } from 'node:url'
import { $fetch } from '@nuxt/test-utils'
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
              logoutUrl: '',
              clientId: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_ID,
              clientSecret: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_SECRET,
              sessionConfiguration: {
                singleSignOut: true,
              },
            },
          },
        },
      },
    },
  },
})

test('single sign out same browser', async ({ page, goto }) => {
  const session = await $fetch('/api/_auth/session')
  expect(session).toStrictEqual({})
  const provider = 'keycloak'
  const providerUrl = url(`/auth/login`)
  const context = page.context()
  const page2 = await context.newPage()
  await page2.goto(providerUrl)
  await page2.click(`button[name="${provider}"]`)
  await page2.waitForURL('http://localhost:8080/**')
  await page2.fill('input[name="username"]', 'testuser')
  await page2.fill('input[name="password"]', 'p@ssword')
  await page2.click('input[name="login"]')
  await page2.waitForURL(url('/'))
  await page.waitForTimeout(1000)
  await goto(url('/'))
  await page.click('button[name="logout"]')
  expect(page).toHaveURL(url('/auth/login'))
  expect(page2).toHaveURL(url('/auth/login'))
})

test('single sign out different browser', async ({ page, browser, goto }) => {
  const provider = 'keycloak'
  const providerUrl = url(`/auth/login`)
  await goto(providerUrl)
  await page.click(`button[name="${provider}"]`)
  await page.fill('input[name="username"]', 'testuser')
  await page.fill('input[name="password"]', 'p@ssword')
  await page.click('input[name="login"]')
  await page.waitForURL(url('/'))
  const context2 = await browser.newContext()
  const page2 = await context2.newPage()
  await page2.goto(providerUrl)
  await page2.click(`button[name="${provider}"]`)
  await page2.fill('input[name="username"]', 'testuser')
  await page2.fill('input[name="password"]', 'p@ssword')
  await page2.click('input[name="login"]')
  await page2.waitForURL(url('/'))
  await page.click('button[name="logout"]')
  expect(page).toHaveURL(url('/auth/login'))
  expect(page2).toHaveURL(url('/auth/login'))
  await context2.close()
})
