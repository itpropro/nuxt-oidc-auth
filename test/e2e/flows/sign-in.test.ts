/**
 * Sign-In Flow E2E Tests
 *
 * Tests for the complete authentication sign-in workflow.
 * These tests verify:
 * - Unauthenticated users are redirected to login
 * - Users can authenticate via provider and receive session
 * - Protected pages preserve redirect destination after auth
 * - Error handling for invalid credentials
 */

import { fileURLToPath } from 'node:url'
import { $fetch } from '@nuxt/test-utils'
import { url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'
import { isProviderConfigured } from '../../setup/env-validator'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/oidcApp', import.meta.url)),
    build: true,
  },
})

test.describe('Sign-In Flow', () => {
  test.describe('Authentication Redirects', () => {
    test('unauthenticated user is redirected to login page', async () => {
      const rootUrl = url('/')
      const response = await fetch(rootUrl)

      expect(response.url).toMatch(url('/auth/login'))
    })

    test('excluded pages are accessible without authentication', async () => {
      const excludedUrl = url('/excluded')
      const response = await fetch(excludedUrl)

      expect(response.url).toMatch(url('/excluded'))

      const html = await $fetch(excludedUrl)
      expect(html).toContain('Excluded page')
    })
  })

  test.describe('Provider Authentication', () => {
    test('user can sign in via Keycloak provider', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

      const provider = 'keycloak'

      await goto(url('/auth/login'))

      await page.click(`button[name="${provider}"]`)

      await page.fill('input[name="username"]', 'testuser')
      await page.fill('input[name="password"]', 'p@ssword')
      await page.click('input[name="login"]')

      await page.waitForURL(url('/'))

      const currentProviderDiv = page.locator('div[name="currentProvider"]')
      expect(await currentProviderDiv.textContent()).toBe(provider)

      const loggedInDiv = page.locator('div[name="loggedIn"]')
      expect(await loggedInDiv.textContent()).toBe('true')
    })
  })

  test.describe('Session State', () => {
    test('authenticated user has valid session data', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

      const provider = 'keycloak'

      await goto(url('/auth/login'))
      await page.click(`button[name="${provider}"]`)
      await page.fill('input[name="username"]', 'testuser')
      await page.fill('input[name="password"]', 'p@ssword')
      await page.click('input[name="login"]')
      await page.waitForURL(url('/'))

      const updatedAt = page.locator('div[name="updatedAt"]')
      const expireAt = page.locator('div[name="expireAt"]')
      const canRefresh = page.locator('div[name="canRefresh"]')

      const updatedAtValue = await updatedAt.textContent()
      const expireAtValue = await expireAt.textContent()

      expect(updatedAtValue).toBeTruthy()
      expect(expireAtValue).toBeTruthy()

      expect(Number(updatedAtValue)).toBeGreaterThan(0)
      expect(Number(expireAtValue)).toBeGreaterThan(0)

      const canRefreshValue = await canRefresh.textContent()
      expect(canRefreshValue).toBe('true')
    })
  })

  test.describe('Protected Page Redirect', () => {
    test('protected page preserves redirect after authentication', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

      await goto(url('/'))

      expect(page.url()).toContain('/auth/login')

      const provider = 'keycloak'
      await page.click(`button[name="${provider}"]`)
      await page.fill('input[name="username"]', 'testuser')
      await page.fill('input[name="password"]', 'p@ssword')
      await page.click('input[name="login"]')

      await page.waitForURL(url('/'))

      const loggedInDiv = page.locator('div[name="loggedIn"]')
      expect(await loggedInDiv.textContent()).toBe('true')
    })
  })

  test.describe('Error Handling', () => {
    test('invalid credentials are handled gracefully', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

      const provider = 'keycloak'

      await goto(url('/auth/login'))

      await page.click(`button[name="${provider}"]`)

      await page.fill('input[name="username"]', 'testuser')
      await page.fill('input[name="password"]', 'wrong-password')
      await page.click('input[name="login"]')

      await page.waitForTimeout(1000)

      expect(page.url()).not.toContain('localhost:3000/')
    })

    test('unauthenticated API requests return appropriate error', async () => {
      const response = await fetch(url('/api/_auth/session'), {
        headers: {
          Accept: 'application/json',
        },
      })

      expect([200, 401, 403]).toContain(response.status)

      if (response.status === 200) {
        const data = await response.json()
        expect(data.loggedIn).toBeFalsy()
      }
    })
  })
})
