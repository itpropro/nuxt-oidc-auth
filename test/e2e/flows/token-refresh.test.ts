/**
 * Token Refresh E2E Tests
 *
 * Tests for token refresh functionality.
 * These tests verify:
 * - Manual token refresh updates session timestamps
 * - Refresh token obtains new access token
 * - Session canRefresh flag is accurate
 */

import { fileURLToPath } from 'node:url'
import { url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'
import { isProviderConfigured } from '../../setup/env-validator'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/oidcApp', import.meta.url)),
    build: true,
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

test.describe('Token Refresh', () => {
  test.describe('Manual Refresh', () => {
    test('refresh button updates session timestamps', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

      await signInWithKeycloak(page, goto)

      const updatedAtBefore = Number(await page.locator('div[name="updatedAt"]').textContent())
      const expireAtBefore = Number(await page.locator('div[name="expireAt"]').textContent())

      await page.waitForTimeout(1100)

      await page.click('button[name="refresh"]')

      await page.waitForTimeout(200)

      const updatedAtAfter = Number(await page.locator('div[name="updatedAt"]').textContent())
      const expireAtAfter = Number(await page.locator('div[name="expireAt"]').textContent())

      expect(updatedAtAfter).toBeGreaterThan(updatedAtBefore)

      expect(expireAtAfter).toBeGreaterThanOrEqual(expireAtBefore)
    })

    test('multiple refreshes work correctly', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

      await signInWithKeycloak(page, goto)

      const timestamps: number[] = []

      for (let i = 0; i < 3; i++) {
        const updatedAt = Number(await page.locator('div[name="updatedAt"]').textContent())
        timestamps.push(updatedAt)

        await page.waitForTimeout(1100)
        await page.click('button[name="refresh"]')
        await page.waitForTimeout(200)
      }

      const finalUpdatedAt = Number(await page.locator('div[name="updatedAt"]').textContent())
      timestamps.push(finalUpdatedAt)

      for (let i = 1; i < timestamps.length; i++) {
        const currentTimestamp = timestamps[i]
        const previousTimestamp = timestamps[i - 1]

        expect(currentTimestamp).toBeDefined()
        expect(previousTimestamp).toBeDefined()

        if (currentTimestamp !== undefined && previousTimestamp !== undefined)
          expect(currentTimestamp).toBeGreaterThan(previousTimestamp)
      }
    })
  })

  test.describe('Refresh Token Availability', () => {
    test('canRefresh flag indicates refresh token is available', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

      await signInWithKeycloak(page, goto)

      const canRefresh = await page.locator('div[name="canRefresh"]').textContent()

      expect(canRefresh).toBe('true')
    })

    test('session remains valid after refresh', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

      await signInWithKeycloak(page, goto)

      const loggedInBefore = await page.locator('div[name="loggedIn"]').textContent()
      expect(loggedInBefore).toBe('true')

      await page.click('button[name="refresh"]')
      await page.waitForTimeout(200)

      const loggedInAfter = await page.locator('div[name="loggedIn"]').textContent()
      expect(loggedInAfter).toBe('true')

      const provider = await page.locator('div[name="currentProvider"]').textContent()
      expect(provider).toBe('keycloak')
    })
  })

  test.describe('Refresh Error Handling', () => {
    test('session state is preserved if refresh fails gracefully', async ({ page, goto }) => {
      test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

      await signInWithKeycloak(page, goto)

      const providerBefore = await page.locator('div[name="currentProvider"]').textContent()

      await page.click('button[name="refresh"]')
      await page.waitForTimeout(500)

      const providerAfter = await page.locator('div[name="currentProvider"]').textContent()
      expect(providerAfter).toBe(providerBefore)
    })
  })
})
