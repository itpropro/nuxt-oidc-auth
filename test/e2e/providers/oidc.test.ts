/**
 * Generic OIDC Provider E2E Tests
 *
 * Reference implementation for offline-capable provider tests.
 * Uses mock OIDC server handlers - no external provider required.
 *
 * This test file demonstrates the pattern for testing providers
 * that can operate in offline mode with mocks.
 */

import { fileURLToPath } from 'node:url'
import { url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/oidcApp', import.meta.url)),
    build: false,
    nuxtConfig: {
      oidc: {
        defaultProvider: 'oidc',
        providers: {
          oidc: {
            clientId: 'mock-client',
            clientSecret: 'mock-secret',
            authorizationUrl: 'http://localhost:3000/mock-oidc/authorize',
            tokenUrl: 'http://localhost:3000/mock-oidc/token',
            userinfoUrl: 'http://localhost:3000/mock-oidc/userinfo',
            redirectUri: 'http://localhost:3000/auth/oidc/callback',
            scope: ['openid', 'profile', 'email'],
            pkce: true,
          },
        },
      },
    },
  },
})

test.describe('Generic OIDC Provider', () => {
  test.describe('Configuration', () => {
    test('provider is available in login options', async ({ page, goto }) => {
      await goto(url('/auth/login'))

      const oidcButton = page.locator('button[name="oidc"]')
      await expect(oidcButton).toBeVisible()
    })
  })

  test.describe('Authentication Flow', () => {
    test.skip('can initiate OIDC login flow', async ({ page, goto }) => {
      await goto(url('/auth/login'))

      await page.click('button[name="oidc"]')

      await page.waitForURL(/mock-oidc\/authorize/)
    })

    test.skip('receives session after successful authentication', async ({ page, goto }) => {
      await goto(url('/auth/login'))
      await page.click('button[name="oidc"]')

      await page.waitForURL(url('/'))

      const loggedIn = await page.locator('div[name="loggedIn"]').textContent()
      expect(loggedIn).toBe('true')

      const provider = await page.locator('div[name="currentProvider"]').textContent()
      expect(provider).toBe('oidc')
    })
  })

  test.describe('PKCE Flow', () => {
    test.skip('uses PKCE when enabled', async ({ page, goto }) => {
      await goto(url('/auth/login'))
      await page.click('button[name="oidc"]')

      await page.waitForURL(/code_challenge=/)

      const currentUrl = page.url()
      expect(currentUrl).toContain('code_challenge_method=S256')
    })
  })

  test.describe('Logout Flow', () => {
    test.skip('can logout from OIDC session', async ({ page }) => {
      await page.click('button[name="logout"]')

      const loggedIn = await page.locator('div[name="loggedIn"]').textContent()
      expect(loggedIn).toBe('false')
    })
  })
})
