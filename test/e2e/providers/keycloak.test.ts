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

import { fetchSession, postFromPage, signInWithKeycloak } from '../utils/keycloak'

const keycloakRealmPattern = /^http:\/\/localhost:8080\/realms\/nuxt-oidc-test\//u
const keycloakHostPattern = /localhost:8080/u

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
            // Another site than the app, so the form_post callback is a cross-site POST
            baseUrl: 'http://localhost:8080/realms/nuxt-oidc-test',
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

test.describe('Keycloak Provider', () => {
  test.describe('Configuration', () => {
    test('provider is available when configured', async ({ request }) => {
      const response = await request.get(url('/auth/keycloak/login'), { maxRedirects: 0 })
      const location = response.headers()['location']

      expect(response.status()).toBe(302)
      expect(location).toMatch(keycloakRealmPattern)
    })
  })

  test.describe('Authentication Flow', () => {
    test('can complete full sign-in flow', async ({ page, goto }) => {
      await signInWithKeycloak(page, goto)

      const loggedIn = await page.locator('div[name="loggedIn"]').textContent()
      expect(loggedIn).toBe('true')

      const provider = await page.locator('div[name="currentProvider"]').textContent()
      expect(provider).toBe('keycloak')
      const cookieNames = (await page.context().cookies()).map(({ name }) => name)
      expect(cookieNames).not.toContain('__Host-oidc')
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

      await postFromPage(page, '/api/test/session-stale')
      expect(await fetchSession(page)).toMatchObject({ provider: 'keycloak', updatedAt: 1 })
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

      await expect(page).toHaveURL(keycloakHostPattern)
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
