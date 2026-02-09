/**
 * Single Sign-Out E2E Tests
 *
 * Tests for the Single Sign-Out (SSO logout) functionality.
 * These tests verify:
 * - Logout in one tab signs out all tabs with same session
 * - Cross-browser session termination
 */

import { fileURLToPath } from 'node:url'
import { $fetch } from '@nuxt/test-utils'
import { url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'
import { isProviderConfigured } from '../../setup/env-validator'

test.use({
  // @ts-expect-error Config overwrite for nuxt test utils
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/oidcApp', import.meta.url)),
    build: true,
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

async function signInWithKeycloak(page: any) {
  const provider = 'keycloak'
  const providerUrl = url('/auth/login')
  await page.goto(providerUrl)
  await page.click(`button[name="${provider}"]`)
  await page.waitForURL('http://localhost:8080/**')
  await page.fill('input[name="username"]', 'testuser')
  await page.fill('input[name="password"]', 'p@ssword')
  await page.click('input[name="login"]')
  await page.waitForURL(url('/'))
}

test.describe('Single Sign-Out', () => {
  test('initial session is empty', async () => {
    const session = await $fetch('/api/_auth/session')
    expect(session).toStrictEqual({})
  })

  test.describe('Same Browser Context', () => {
    test('logout in one tab signs out other tabs in same context', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

      const context = page.context()
      const page2 = await context.newPage()

      await signInWithKeycloak(page2)

      await page.waitForTimeout(1000)

      await goto(url('/'))

      const loggedInPage1 = await page.locator('div[name="loggedIn"]').textContent()
      expect(loggedInPage1).toBe('true')

      await page.click('button[name="logout"]')

      expect(page.url()).toMatch(/^http:\/\/localhost:8080/)

      await expect(page2).toHaveURL(url('/auth/login'))
    })
  })

  test.describe('Different Browser Contexts', () => {
    test('logout propagates across different browser contexts', async ({ page, browser, goto }) => {
      test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

      await goto(url('/auth/login'))
      await page.click('button[name="keycloak"]')
      await page.fill('input[name="username"]', 'testuser')
      await page.fill('input[name="password"]', 'p@ssword')
      await page.click('input[name="login"]')
      await page.waitForURL(url('/'))

      const context2 = await browser.newContext()
      const page2 = await context2.newPage()

      await page2.goto(url('/auth/login'))
      await page2.click('button[name="keycloak"]')
      await page2.fill('input[name="username"]', 'testuser')
      await page2.fill('input[name="password"]', 'p@ssword')
      await page2.click('input[name="login"]')
      await page2.waitForURL(url('/'))

      const loggedIn1 = await page.locator('div[name="loggedIn"]').textContent()
      const loggedIn2 = await page2.locator('div[name="loggedIn"]').textContent()
      expect(loggedIn1).toBe('true')
      expect(loggedIn2).toBe('true')

      await page.click('button[name="logout"]')

      expect(page.url()).toMatch(/^http:\/\/localhost:8080/)

      await expect(page2).toHaveURL(url('/auth/login'))

      await context2.close()
    })
  })

  test.describe('SSO Session Verification', () => {
    test('singleSignOut flag is exposed in session data', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

      await goto(url('/auth/login'))
      await page.click('button[name="keycloak"]')
      await page.fill('input[name="username"]', 'testuser')
      await page.fill('input[name="password"]', 'p@ssword')
      await page.click('input[name="login"]')
      await page.waitForURL(url('/'))

      const ssoValue = await page.locator('div[name="singleSignOut"]').textContent()
      expect(ssoValue).toBe('true')
    })
  })
})
