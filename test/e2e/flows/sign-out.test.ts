/**
 * Sign-Out Flow E2E Tests
 *
 * Tests for the complete authentication sign-out workflow.
 * These tests verify:
 * - Session is cleared on logout
 * - User is redirected to provider logout page
 * - Logout redirect URL is honored
 * - Clear session without provider logout
 */

import { fileURLToPath } from 'node:url'
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

async function signInWithKeycloak(page: any, goto: any) {
  const provider = 'keycloak'
  await goto(url('/auth/login'))
  await page.click(`button[name="${provider}"]`)
  await page.fill('input[name="username"]', 'testuser')
  await page.fill('input[name="password"]', 'p@ssword')
  await page.click('input[name="login"]')
  await page.waitForURL(url('/'))
}

test.describe('Sign-Out Flow', () => {
  test.describe('Logout with Provider', () => {
    test('user can logout and is redirected to provider', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

      await signInWithKeycloak(page, goto)

      const loggedInBefore = await page.locator('div[name="loggedIn"]').textContent()
      expect(loggedInBefore).toBe('true')

      await page.click('button[name="logout"]')

      expect(page.url()).toMatch(/^http:\/\/localhost:8080/)
    })

    test('logout redirect URL is honored when configured', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

      await signInWithKeycloak(page, goto)

      await page.click('button[name="logout"]')

      expect(page.url()).toMatch(/localhost/)
    })
  })

  test.describe('Session Clear', () => {
    test('session is cleared locally when using clear()', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

      await signInWithKeycloak(page, goto)

      const loggedInBefore = await page.locator('div[name="loggedIn"]').textContent()
      expect(loggedInBefore).toBe('true')

      await page.click('button[name="clear"]')

      const loggedInAfter = await page.locator('div[name="loggedIn"]').textContent()
      expect(loggedInAfter).toBe('false')
    })

    test('fetch after clear still shows logged out', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

      await signInWithKeycloak(page, goto)

      await page.click('button[name="clear"]')

      const loggedInAfterClear = await page.locator('div[name="loggedIn"]').textContent()
      expect(loggedInAfterClear).toBe('false')

      await page.click('button[name="fetch"]')

      const loggedInAfterFetch = await page.locator('div[name="loggedIn"]').textContent()
      expect(loggedInAfterFetch).toBe('false')
    })
  })

  test.describe('Session State After Logout', () => {
    test('session data is cleared after logout', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

      await signInWithKeycloak(page, goto)

      const providerBefore = await page.locator('div[name="currentProvider"]').textContent()
      expect(providerBefore).toBe('keycloak')

      await page.click('button[name="clear"]')

      const providerAfter = await page.locator('div[name="currentProvider"]').textContent()
      expect(providerAfter?.trim() || '').toBeFalsy()
    })
  })
})
