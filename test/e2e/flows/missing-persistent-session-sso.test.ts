import { fileURLToPath } from 'node:url'
import { expect, test } from '@nuxt/test-utils/playwright'
import { removePersistentSession, signInWithKeycloak } from '../utils/missing-persistent-session'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/oidcApp', import.meta.url)),
    build: true,
    port: 3000,
    nuxtConfig: {
      oidc: {
        session: {
          missingPersistentSession: 'silent',
        },
        providers: {
          keycloak: {
            baseUrl: 'http://127.0.0.1:8080/realms/nuxt-oidc-test',
            clientId: 'nuxt-oidc-test',
            clientSecret: 'nuxt-oidc-test-secret',
            redirectUri: 'http://127.0.0.1:3000/auth/keycloak/callback',
            sessionConfiguration: {
              singleSignOut: true,
              missingPersistentSession: 'silent',
            },
          },
        },
      },
    },
  },
})

test('forces stale session clear when single sign out is enabled', async ({ page, goto }) => {
  await signInWithKeycloak(page, goto)
  await removePersistentSession(page)
  await page.click('button[name="fetch"]')

  await expect(page.locator('div[name="loggedIn"]')).toHaveText('false')
})
