import { fileURLToPath } from 'node:url'

import { createResolver, loadNuxt, runWithNuxtContext } from '@nuxt/kit'
import type { Nuxt } from 'nuxt/schema'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setupDevToolsUI } from '../../../src/devtools'

interface DevtoolsRpc {
  getNuxtOidcAuthConfig: (token: string) => Promise<{
    providers: Record<string, unknown>
    devMode: Record<string, unknown>
  }>
  getNuxtOidcAuthSecrets: (
    token: string,
  ) => Promise<Record<'tokenKey' | 'sessionSecret' | 'authSessionSecret', string>>
}

const fixtureDir = fileURLToPath(new URL('../../fixtures/oidcApp', import.meta.url))
const resolver = createResolver(import.meta.url)
let nuxt: Nuxt

async function registerDevtoolsRpc(
  ensureDevAuthToken?: (token: string) => Promise<void>,
): Promise<DevtoolsRpc> {
  let registeredRpc: DevtoolsRpc | undefined
  const context = {
    ensureDevAuthToken,
    options: { disableAuthorization: false },
    extendServerRpc: (namespace: string, functions: DevtoolsRpc) => {
      expect(namespace).toBe('nuxt-oidc-auth-rpc')
      registeredRpc = functions
    },
  }
  Object.assign(nuxt, { devtools: context })
  runWithNuxtContext(nuxt, () => {
    setupDevToolsUI(nuxt, resolver, { isDevMode: false })
  })
  await runWithNuxtContext(nuxt, async () => {
    await nuxt.callHook('devtools:initialized', {
      version: 'test',
      packagePath: fixtureDir,
      isGlobalInstall: false,
    })
  })
  if (!registeredRpc) {
    throw new Error('Devtools RPC was not registered')
  }
  if (!ensureDevAuthToken) {
    Reflect.deleteProperty(nuxt, 'devtools')
  }
  return registeredRpc
}

describe('devtools secrets rpc auth', () => {
  beforeEach(async () => {
    nuxt = await loadNuxt({
      cwd: fixtureDir,
      dev: false,
      ready: false,
      overrides: { modules: [], devtools: false },
    })
  })

  afterEach(async () => {
    await nuxt.close()
  })

  it('rejects unauthenticated rpc calls', async () => {
    const ensureDevAuthToken = vi.fn<(token: string) => Promise<void>>(async (token) => {
      if (token !== 'valid-token') {
        throw new Error('Invalid dev auth token.')
      }
    })

    const rpc = await registerDevtoolsRpc(ensureDevAuthToken)

    await expect(rpc.getNuxtOidcAuthConfig('invalid-token')).rejects.toThrow(
      'Invalid dev auth token.',
    )
    await expect(rpc.getNuxtOidcAuthSecrets('invalid-token')).rejects.toThrow(
      'Invalid dev auth token.',
    )
    expect(ensureDevAuthToken).toHaveBeenCalledTimes(2)
    expect(ensureDevAuthToken).toHaveBeenCalledWith('invalid-token')
  })

  it('rejects authenticated secret retrieval outside the dev server despite runtime dev mode', async () => {
    const ensureDevAuthToken = vi.fn<(token: string) => Promise<void>>(async () => {})
    Object.assign(nuxt.options.runtimeConfig, { oidc: { devMode: { enabled: true } } })

    const rpc = await registerDevtoolsRpc(ensureDevAuthToken)

    await expect(rpc.getNuxtOidcAuthSecrets('valid-token')).rejects.toThrow(
      '[nuxt-oidc-auth] Secrets are only available on the dev server with dev mode enabled.',
    )
    expect(ensureDevAuthToken).toHaveBeenCalledWith('valid-token')
  })

  it('fails closed when the devtools context is unavailable', async () => {
    const rpc = await registerDevtoolsRpc()

    await expect(rpc.getNuxtOidcAuthSecrets('valid-token')).rejects.toThrow(
      '[nuxt-oidc-auth] Nuxt DevTools context is unavailable.',
    )
  })

  it('returns resolved provider config with sensitive values and sentinels filtered', async () => {
    const ensureDevAuthToken = vi.fn<(token: string) => Promise<void>>(async () => {})
    Object.assign(nuxt.options.runtimeConfig, {
      oidc: {
        session: { automaticRefresh: false, expirationThreshold: 600 },
        providers: {
          oidc: {
            baseUrl: 'https://issuer.example.com',
            authorizationUrl: 'authorize',
            tokenUrl: 'token',
            clientId: 'client-id',
            clientSecret: 'client-secret',
            exposeAccessToken: true,
            proxy: 'https://user:password@proxy.example.com',
            scope: '__NUXT_OIDC_RUNTIME_CONFIG_UNSET__',
            additionalTokenParameters: {
              apiKey: 'provider-api-key',
              audience: 'token-audience',
              boolean_secret: true,
              client_assertion: 'signed-client-assertion',
              client_secret: 'nested-secret',
              nested: { credential: 'nested-credential' },
              numeric_api_key: 42,
              secret: 'provider-generic-secret',
            },
            additionalAuthParameters: {
              API_KEY: 'authorization-api-key',
              'CLIENT-ASSERTION': false,
              'api.key': 1234,
              nested: { bearer_token: 'authorization-bearer-token' },
              password: 'authorization-password',
            },
          },
        },
        devMode: {
          enabled: true,
          accessToken: 'development-access-token',
        },
      },
    })
    const rpc = await registerDevtoolsRpc(ensureDevAuthToken)

    const config = await rpc.getNuxtOidcAuthConfig('valid-token')
    const provider = config.providers['oidc']

    expect(provider).toHaveProperty('authorizationUrl', 'https://issuer.example.com/authorize')
    expect(provider).toHaveProperty('tokenUrl', 'https://issuer.example.com/token')
    expect(provider).toHaveProperty('clientSecret', '[redacted]')
    expect(provider).toHaveProperty('exposeAccessToken', true)
    expect(provider).toHaveProperty('sessionConfiguration.automaticRefresh', false)
    expect(provider).toHaveProperty('sessionConfiguration.expirationThreshold', 600)
    expect(provider).toHaveProperty('proxy', '[redacted]')
    expect(provider).toHaveProperty('additionalTokenParameters', {
      apiKey: '[redacted]',
      audience: '[redacted]',
      boolean_secret: '[redacted]',
      client_assertion: '[redacted]',
      client_secret: '[redacted]',
      nested: '[redacted]',
      numeric_api_key: '[redacted]',
      secret: '[redacted]',
    })
    expect(provider).toHaveProperty('additionalAuthParameters', {
      API_KEY: '[redacted]',
      'CLIENT-ASSERTION': '[redacted]',
      'api.key': '[redacted]',
      nested: { bearer_token: '[redacted]' },
      password: '[redacted]',
    })
    expect(config.devMode).toStrictEqual({ enabled: true, accessToken: '[redacted]' })
    expect(JSON.stringify(config)).not.toContain('NUXT_OIDC_RUNTIME_CONFIG_UNSET')
    expect(JSON.stringify(config)).not.toContain('client-secret')
    expect(JSON.stringify(config)).not.toContain('nested-secret')
    expect(JSON.stringify(config)).not.toContain('signed-client-assertion')
    expect(JSON.stringify(config)).not.toContain('provider-api-key')
    expect(JSON.stringify(config)).not.toContain('provider-generic-secret')
    expect(JSON.stringify(config)).not.toContain('nested-credential')
    expect(JSON.stringify(config)).not.toContain('authorization-api-key')
    expect(JSON.stringify(config)).not.toContain('authorization-password')
    expect(JSON.stringify(config)).not.toContain('authorization-bearer-token')
    expect(JSON.stringify(config)).not.toContain('development-access-token')
    expect(ensureDevAuthToken).toHaveBeenCalledWith('valid-token')
  })
})
