import { fileURLToPath } from 'node:url'

import { expect, test } from '@nuxt/test-utils/playwright'

import { fetchSession, removePersistentSession, signInWithKeycloak } from '../utils/keycloak'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/oidcApp', import.meta.url)),
    build: true,
    port: 3000,
    nuxtConfig: {
      oidc: {
        session: {
          missingPersistentSession: 'warn',
        },
        providers: {
          keycloak: {
            audience: 'account',
            baseUrl: 'http://127.0.0.1:8080/realms/nuxt-oidc-test',
            clientId: 'nuxt-oidc-test',
            clientSecret: 'nuxt-oidc-test-secret',
            redirectUri: 'http://127.0.0.1:3000/auth/keycloak/callback',
            sessionConfiguration: {
              singleSignOut: false,
            },
          },
        },
      },
    },
  },
})

test('keeps user logged in when mode is warn and persistent entry is missing', async ({
  page,
  goto,
}) => {
  await signInWithKeycloak(page, goto)
  await removePersistentSession(page)
  expect(await fetchSession(page)).toMatchObject({ provider: 'keycloak' })

  await expect(page.locator('div[name="loggedIn"]')).toHaveText('true')
})
