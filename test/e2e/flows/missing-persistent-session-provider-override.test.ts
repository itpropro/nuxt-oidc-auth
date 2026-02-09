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
                missingPersistentSession: 'warn',
              },
            },
          },
        },
      },
    },
  },
})

test('uses provider missingPersistentSession setting over global setting', async ({ page, goto }) => {
  test.skip(!isProviderConfigured('keycloak'), 'Keycloak not configured')

  await signInWithKeycloak(page, goto)
  await removePersistentSession(page)
  await page.click('button[name="fetch"]')

  const loggedIn = await page.locator('div[name="loggedIn"]').textContent()
  expect(loggedIn).toBe('true')
})
