/**
 * Auth0 Provider E2E Tests
 *
 * Reference implementation for online provider tests.
 * Requires Auth0 credentials to be configured in environment.
 *
 * This test file demonstrates the pattern for testing providers
 * that require real provider credentials.
 */

import { fileURLToPath } from 'node:url'
import { url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'
import { isProviderConfigured, skipUnlessConfigured } from '../../setup/env-validator'

test.beforeAll(() => {
  skipUnlessConfigured('auth0')
})

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/oidcApp', import.meta.url)),
    build: false,
    nuxtConfig: {
      oidc: {
        defaultProvider: 'auth0',
        providers: {
          auth0: {
            clientId: process.env.NUXT_OIDC_PROVIDERS_AUTH0_CLIENT_ID,
            clientSecret: process.env.NUXT_OIDC_PROVIDERS_AUTH0_CLIENT_SECRET,
            baseUrl: process.env.NUXT_OIDC_PROVIDERS_AUTH0_BASE_URL,
            redirectUri: 'http://localhost:3000/auth/auth0/callback',
            scope: ['openid', 'profile', 'email', 'offline_access'],
          },
        },
      },
    },
  },
})

test.describe('Auth0 Provider', () => {
  test.describe('Configuration', () => {
    test('provider is available when configured', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('auth0'), 'Auth0 not configured')

      await goto(url('/auth/login'))

      const auth0Button = page.locator('button[name="auth0"]')
      await expect(auth0Button).toBeVisible()
    })
  })

  test.describe('Authentication Flow', () => {
    test('can initiate Auth0 login flow', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('auth0'), 'Auth0 not configured')

      await goto(url('/auth/login'))

      await page.click('button[name="auth0"]')

      await page.waitForURL(/auth0\.com\/authorize/)

      const currentUrl = page.url()
      expect(currentUrl).toContain('client_id=')
      expect(currentUrl).toContain('redirect_uri=')
      expect(currentUrl).toContain('response_type=code')
    })

    test('Auth0 login page is displayed', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('auth0'), 'Auth0 not configured')

      await goto(url('/auth/login'))
      await page.click('button[name="auth0"]')

      await page.waitForURL(/auth0\.com/)

      await expect(page.locator('input[name="email"], input[name="username"]')).toBeVisible({ timeout: 10000 })
    })

    test.skip('receives session after successful authentication', async ({ page, goto }) => {
      await goto(url('/auth/login'))
      await page.click('button[name="auth0"]')

      await page.fill('input[name="email"]', process.env.AUTH0_TEST_USER_EMAIL || '')
      await page.fill('input[name="password"]', process.env.AUTH0_TEST_USER_PASSWORD || '')
      await page.click('button[type="submit"]')

      await page.waitForURL(url('/'), { timeout: 15000 })

      const loggedIn = await page.locator('div[name="loggedIn"]').textContent()
      expect(loggedIn).toBe('true')

      const provider = await page.locator('div[name="currentProvider"]').textContent()
      expect(provider).toBe('auth0')
    })
  })

  test.describe('Token Management', () => {
    test.skip('can refresh Auth0 tokens', async ({ page }) => {
      const canRefresh = await page.locator('div[name="canRefresh"]').textContent()
      expect(canRefresh).toBe('true')

      const updatedAtBefore = Number(await page.locator('div[name="updatedAt"]').textContent())
      await page.click('button[name="refresh"]')
      await page.waitForTimeout(1000)
      const updatedAtAfter = Number(await page.locator('div[name="updatedAt"]').textContent())

      expect(updatedAtAfter).toBeGreaterThan(updatedAtBefore)
    })
  })

  test.describe('Logout Flow', () => {
    test.skip('can logout from Auth0', async ({ page }) => {
      await page.click('button[name="logout"]')

      await page.waitForURL(/auth0\.com\/logout|auth0\.com\/v2\/logout/)
    })
  })
})

/**
 * Pattern: Provider Test Template
 *
 * When adding tests for a new provider, follow this structure:
 *
 * 1. Import env-validator and check configuration
 * 2. Configure nuxt fixture with provider settings
 * 3. Group tests by functionality:
 *    - Configuration (provider availability)
 *    - Authentication Flow (login initiation, completion)
 *    - Token Management (refresh capability)
 *    - Logout Flow (session termination)
 *
 * 4. Use test.skip() with isProviderConfigured() for optional tests
 * 5. Document any manual steps or test user requirements
 */
