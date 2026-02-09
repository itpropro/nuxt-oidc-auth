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
    build: true,
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
  })
})
