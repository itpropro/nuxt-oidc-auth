import { fileURLToPath } from 'node:url'

import { loadNuxt } from '@nuxt/kit'
import type { NuxtApp } from '@nuxt/schema'
import { describe, expect, it } from 'vitest'

const NOOP_MIDDLEWARE_PATH = /runtime\/middleware\/noop$/u

const fixtureDir = fileURLToPath(new URL('../fixtures/oidcApp', import.meta.url))

describe('module setup', () => {
  it('publishes only the middleware redirect flag to the browser', async () => {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
      dev: false,
      overrides: {
        oidc: {
          middleware: { globalMiddlewareEnabled: false, redirect: false },
        },
      },
    })

    try {
      expect(nuxt.options.runtimeConfig.public.oidc).toStrictEqual({
        middleware: { redirect: false },
      })
    } finally {
      await nuxt.close()
    }
  })

  it('keeps the named middleware resolvable as a no-op when the module is disabled', async () => {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
      dev: false,
      overrides: { oidc: { enabled: false } },
    })

    try {
      const app: NuxtApp = {
        dir: fixtureDir,
        extensions: [],
        plugins: [],
        components: [],
        layouts: {},
        middleware: [],
        templates: [],
        configs: [],
      }
      await nuxt.callHook('app:resolve', app)
      const middleware = app.middleware.find(({ name }) => name === 'oidc-auth')
      expect(middleware?.path).toMatch(NOOP_MIDDLEWARE_PATH)
    } finally {
      await nuxt.close()
    }
  })

  it('registers SSO runtime support when static provider config disables it', async () => {
    const nuxt = await loadNuxt({
      cwd: fixtureDir,
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
          (typeof plugin === 'string' ? plugin : plugin.src).includes('sso.client'),
        ),
      ).toBe(true)
      expect(nuxt.options.serverHandlers).toContainEqual(
        expect.objectContaining({ route: '/api/_auth/sso', method: 'get' }),
      )
      expect(nuxt.options.nitro.imports).toHaveProperty(
        'presets',
        expect.arrayContaining([expect.objectContaining({ imports: ['useOidcProviderConfig'] })]),
      )
    } finally {
      await nuxt.close()
    }
  })
})
