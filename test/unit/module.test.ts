import { fileURLToPath } from 'node:url'
import { loadNuxt } from '@nuxt/kit'
import { describe, expect, it } from 'vitest'

describe('module setup', () => {
  it('registers SSO runtime support when static provider config disables it', async () => {
    const nuxt = await loadNuxt({
      cwd: fileURLToPath(new URL('../fixtures/oidcApp', import.meta.url)),
      dev: false,
      overrides: {
        oidc: {
          providers: {
            oidc: {
              redirectUri: 'http://localhost:3000/auth/oidc/callback',
              sessionConfiguration: { singleSignOut: false },
            },
            keycloak: {
              redirectUri: 'http://localhost:3000/auth/keycloak/callback',
              sessionConfiguration: { singleSignOut: false },
            },
          },
        },
      },
    })

    try {
      expect(
        nuxt.options.plugins.some((plugin) =>
          String(typeof plugin === 'string' ? plugin : plugin.src).includes('sso.client'),
        ),
      ).toBe(true)
      expect(nuxt.options.serverHandlers).toContainEqual(
        expect.objectContaining({ route: '/api/_auth/sso', method: 'get' }),
      )
    } finally {
      await nuxt.close()
    }
  })
})
