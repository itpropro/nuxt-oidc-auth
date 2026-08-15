import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from 'nuxt/schema'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

type DevtoolsRpc = {
  getNuxtOidcAuthConfig: (token: string) => Promise<{
    providers: Record<string, unknown>
    devMode: Record<string, unknown>
  }>
  getNuxtOidcAuthSecrets: (
    token: string,
  ) => Promise<Record<'tokenKey' | 'sessionSecret' | 'authSessionSecret', string>>
}

const { existsSyncMock, extendServerRpcMock, onDevToolsInitializedMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn<(path: string) => boolean>(() => true),
  extendServerRpcMock: vi.fn<(namespace: string, functions: DevtoolsRpc) => void>(),
  onDevToolsInitializedMock: vi.fn<(handler: (info: unknown) => Promise<void> | void) => void>(),
}))

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
}))

vi.mock('@nuxt/devtools-kit', () => ({
  extendServerRpc: extendServerRpcMock,
  onDevToolsInitialized: onDevToolsInitializedMock,
}))

import { setupDevToolsUI } from '../../../src/devtools'

const originalSecrets = {
  tokenKey: process.env.NUXT_OIDC_TOKEN_KEY,
  sessionSecret: process.env.NUXT_OIDC_SESSION_SECRET,
  authSessionSecret: process.env.NUXT_OIDC_AUTH_SESSION_SECRET,
}

function createResolver(): Resolver {
  return {
    resolve: () => '/virtual/client',
  } as Resolver
}

async function registerDevtoolsRpc(nuxt: Nuxt): Promise<DevtoolsRpc> {
  setupDevToolsUI(nuxt, createResolver())

  expect(onDevToolsInitializedMock).toHaveBeenCalledTimes(1)

  const initialized = onDevToolsInitializedMock.mock.calls[0]?.[0]
  expect(initialized).toBeTypeOf('function')

  await initialized?.({})

  expect(extendServerRpcMock).toHaveBeenCalledWith('nuxt-oidc-auth-rpc', expect.any(Object))

  return extendServerRpcMock.mock.calls[0]![1]
}

describe('devtools secrets rpc auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    existsSyncMock.mockReturnValue(true)

    process.env.NUXT_OIDC_TOKEN_KEY = 'token-key'
    process.env.NUXT_OIDC_SESSION_SECRET = 'session-secret'
    process.env.NUXT_OIDC_AUTH_SESSION_SECRET = 'auth-session-secret'
  })

  afterAll(() => {
    process.env.NUXT_OIDC_TOKEN_KEY = originalSecrets.tokenKey
    process.env.NUXT_OIDC_SESSION_SECRET = originalSecrets.sessionSecret
    process.env.NUXT_OIDC_AUTH_SESSION_SECRET = originalSecrets.authSessionSecret
  })

  it('rejects unauthenticated rpc calls', async () => {
    const ensureDevAuthToken = vi.fn<(token: string) => Promise<void>>(async (token) => {
      if (token !== 'valid-token') {
        throw new Error('Invalid dev auth token.')
      }
    })

    const rpc = await registerDevtoolsRpc({
      devtools: { ensureDevAuthToken },
      hook: () => {},
      options: { runtimeConfig: {} },
    } as unknown as Nuxt)

    await expect(rpc.getNuxtOidcAuthConfig('invalid-token')).rejects.toThrow(
      'Invalid dev auth token.',
    )
    await expect(rpc.getNuxtOidcAuthSecrets('invalid-token')).rejects.toThrow(
      'Invalid dev auth token.',
    )
    expect(ensureDevAuthToken).toHaveBeenCalledTimes(2)
    expect(ensureDevAuthToken).toHaveBeenCalledWith('invalid-token')
  })

  it('returns secrets after token verification succeeds', async () => {
    const ensureDevAuthToken = vi.fn<(token: string) => Promise<void>>(async () => {})

    const rpc = await registerDevtoolsRpc({
      devtools: { ensureDevAuthToken },
      hook: () => {},
      options: { runtimeConfig: {} },
    } as unknown as Nuxt)

    await expect(rpc.getNuxtOidcAuthSecrets('valid-token')).resolves.toEqual({
      tokenKey: 'token-key',
      sessionSecret: 'session-secret',
      authSessionSecret: 'auth-session-secret',
    })
    expect(ensureDevAuthToken).toHaveBeenCalledWith('valid-token')
  })

  it('fails closed when the devtools context is unavailable', async () => {
    const rpc = await registerDevtoolsRpc({
      hook: () => {},
      options: { runtimeConfig: {} },
    } as unknown as Nuxt)

    await expect(rpc.getNuxtOidcAuthSecrets('valid-token')).rejects.toThrow(
      '[nuxt-oidc-auth] Nuxt DevTools context is unavailable.',
    )
  })

  it('returns resolved provider config with sensitive values and sentinels filtered', async () => {
    const ensureDevAuthToken = vi.fn<(token: string) => Promise<void>>(async () => {})
    const rpc = await registerDevtoolsRpc({
      devtools: { ensureDevAuthToken },
      hook: () => {},
      options: {
        runtimeConfig: {
          oidc: {
            providers: {
              oidc: {
                baseUrl: 'https://issuer.example.com',
                authorizationUrl: 'authorize',
                tokenUrl: 'token',
                clientId: 'client-id',
                clientSecret: 'client-secret',
                proxy: 'https://user:password@proxy.example.com',
                scope: '__NUXT_OIDC_RUNTIME_CONFIG_UNSET__',
                additionalTokenParameters: {
                  client_secret: 'nested-secret',
                },
              },
            },
            devMode: {
              enabled: true,
              accessToken: 'development-access-token',
            },
          },
        },
      },
    } as unknown as Nuxt)

    const config = await rpc.getNuxtOidcAuthConfig('valid-token')
    const provider = config.providers.oidc as Record<string, unknown>

    expect(provider.authorizationUrl).toBe('https://issuer.example.com/authorize')
    expect(provider.tokenUrl).toBe('https://issuer.example.com/token')
    expect(provider.clientSecret).toBe('[redacted]')
    expect(provider.proxy).toBe('[redacted]')
    expect(provider.additionalTokenParameters).toEqual({ client_secret: '[redacted]' })
    expect(config.devMode).toEqual({ enabled: true, accessToken: '[redacted]' })
    expect(JSON.stringify(config)).not.toContain('NUXT_OIDC_RUNTIME_CONFIG_UNSET')
    expect(JSON.stringify(config)).not.toContain('client-secret')
    expect(JSON.stringify(config)).not.toContain('nested-secret')
    expect(JSON.stringify(config)).not.toContain('development-access-token')
    expect(ensureDevAuthToken).toHaveBeenCalledWith('valid-token')
  })
})
