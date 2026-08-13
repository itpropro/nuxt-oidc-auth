/**
 * Keycloak Provider E2E Tests
 *
 * Tests for Keycloak authentication provider.
 * Requires a running Keycloak server and configured credentials.
 *
 * Note: Keycloak tests are disabled by default. To enable:
 * Set NUXT_OIDC_TEST_ENABLE_KEYCLOAK=true in your environment.
 */

import { fileURLToPath } from 'node:url'
import { url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/oidcApp', import.meta.url)),
    build: true,
    port: 3000,
    nuxtConfig: {
      oidc: {
        defaultProvider: 'keycloak',
        providers: {
          keycloak: {
            clientId: 'nuxt-oidc-test',
            clientSecret: 'nuxt-oidc-test-secret',
            baseUrl: 'http://127.0.0.1:8080/realms/nuxt-oidc-test',
            redirectUri: 'http://127.0.0.1:3000/auth/keycloak/callback',
            audience: 'account',
            userNameClaim: 'preferred_username',
            sessionConfiguration: {
              singleSignOut: true,
            },
          },
        },
      },
    },
  },
})

async function signInWithKeycloak(page: Page, goto: (path: string) => Promise<unknown>) {
  await goto(url('/auth/login'))
  await page.click('button[name="keycloak"]')
  await page.fill('input[name="username"]', 'testuser')
  await page.fill('input[name="password"]', 'p@ssword')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL(url('/'))
}

test.describe('Keycloak Provider', () => {
  test.describe('Configuration', () => {
    test('provider is available when configured', async ({ page, goto }) => {
      await goto(url('/auth/login'))

      const keycloakButton = page.locator('button[name="keycloak"]')
      await expect(keycloakButton).toBeVisible()
    })
  })

  test.describe('Authentication Flow', () => {
    test('can complete full sign-in flow', async ({ page, goto }) => {
      await signInWithKeycloak(page, goto)

      const loggedIn = await page.locator('div[name="loggedIn"]').textContent()
      expect(loggedIn).toBe('true')

      const provider = await page.locator('div[name="currentProvider"]').textContent()
      expect(provider).toBe('keycloak')
    })

    test('session includes expected user data', async ({ page, goto }) => {
      await signInWithKeycloak(page, goto)

      const updatedAt = await page.locator('div[name="updatedAt"]').textContent()
      const expireAt = await page.locator('div[name="expireAt"]').textContent()

      expect(Number(updatedAt)).toBeGreaterThan(0)
      expect(Number(expireAt)).toBeGreaterThan(0)
    })
  })

  test.describe('Token Refresh', () => {
    test('can refresh Keycloak tokens', async ({ page, goto }) => {
      await signInWithKeycloak(page, goto)

      const canRefresh = await page.locator('div[name="canRefresh"]').textContent()
      expect(canRefresh).toBe('true')

      await page.context().request.post(new URL('/api/test/session-stale', url('/')).toString())
      await page.click('button[name="fetch"]')
      await expect(page.locator('div[name="updatedAt"]')).toHaveText('1')
      const updatedAtBefore = Number(await page.locator('div[name="updatedAt"]').textContent())
      await page.click('button[name="refresh"]')
      await expect
        .poll(async () => Number(await page.locator('div[name="updatedAt"]').textContent()))
        .toBeGreaterThan(updatedAtBefore)
    })
  })

  test.describe('Logout Flow', () => {
    test('can logout from Keycloak', async ({ page, goto }) => {
      await signInWithKeycloak(page, goto)

      await page.click('button[name="logout"]')

      expect(page.url()).toMatch(/127\.0\.0\.1:8080/)
    })
  })

  test.describe('Single Sign-Out', () => {
    test('single sign-out is enabled', async ({ page, goto }) => {
      await signInWithKeycloak(page, goto)

      const ssoValue = await page.locator('div[name="singleSignOut"]').textContent()
      expect(ssoValue).toBe('true')
    })
  })
})
