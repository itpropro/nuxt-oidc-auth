import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from 'nuxt/schema'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

type SecretsRpc = {
  getNuxtOidcAuthSecrets: (
    token: string,
  ) => Promise<Record<'tokenKey' | 'sessionSecret' | 'authSessionSecret', string>>
}

const { existsSyncMock, extendServerRpcMock, onDevToolsInitializedMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn<(path: string) => boolean>(() => true),
  extendServerRpcMock: vi.fn<(namespace: string, functions: SecretsRpc) => void>(),
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

async function registerSecretsRpc(nuxt: Nuxt): Promise<SecretsRpc> {
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

    const rpc = await registerSecretsRpc({
      devtools: { ensureDevAuthToken },
      hook: () => {},
    } as unknown as Nuxt)

    await expect(rpc.getNuxtOidcAuthSecrets('invalid-token')).rejects.toThrow(
      'Invalid dev auth token.',
    )
    expect(ensureDevAuthToken).toHaveBeenCalledWith('invalid-token')
  })

  it('returns secrets after token verification succeeds', async () => {
    const ensureDevAuthToken = vi.fn<(token: string) => Promise<void>>(async () => {})

    const rpc = await registerSecretsRpc({
      devtools: { ensureDevAuthToken },
      hook: () => {},
    } as unknown as Nuxt)

    await expect(rpc.getNuxtOidcAuthSecrets('valid-token')).resolves.toEqual({
      tokenKey: 'token-key',
      sessionSecret: 'session-secret',
      authSessionSecret: 'auth-session-secret',
    })
    expect(ensureDevAuthToken).toHaveBeenCalledWith('valid-token')
  })

  it('fails closed when the devtools context is unavailable', async () => {
    const rpc = await registerSecretsRpc({
      hook: () => {},
    } as unknown as Nuxt)

    await expect(rpc.getNuxtOidcAuthSecrets('valid-token')).rejects.toThrow(
      '[nuxt-oidc-auth] Nuxt DevTools context is unavailable.',
    )
  })
})
