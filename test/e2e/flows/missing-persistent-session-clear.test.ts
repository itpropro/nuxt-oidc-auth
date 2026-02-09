import { fileURLToPath } from 'node:url'
import { expect, test } from '@nuxt/test-utils/playwright'
import { isProviderConfigured } from '../../setup/env-validator'
import { removePersistentSession, signInWithKeycloak } from '../utils/missing-persistent-session'

test.use({
  // @ts-expect-error Config overwrite for nuxt test utils
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/oidcApp', import.meta.url)),
    build: true,
    nuxtConfig: {
      runtimeConfig: {
        oidc: {
          session: {
            missingPersistentSession: 'clear',
          },
          providers: {
            keycloak: {
              clientId: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_ID,
              clientSecret: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_SECRET,
              sessionConfiguration: {
                singleSignOut: false,
              },
            },
          },
        },
      },
    },
  },
})

test.describe('Missing Persistent Session - clear', () => {
  test.describe.configure({ mode: 'serial' })

  test('clears stale session when persistent entry is missing', async ({ page, goto }) => {
    test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

    await signInWithKeycloak(page, goto)
    await removePersistentSession(page)
    await page.click('button[name="fetch"]')

    const loggedIn = await page.locator('div[name="loggedIn"]').textContent()
    expect(loggedIn).toBe('false')
  })

  test('refresh request logs out when refresh token storage is missing', async ({ page, goto }) => {
    test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

    await signInWithKeycloak(page, goto)
    await removePersistentSession(page)
    await page.click('button[name="refresh"]')

    const loggedIn = await page.locator('div[name="loggedIn"]').textContent()
    expect(loggedIn).toBe('false')
  })
})
