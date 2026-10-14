import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useOidcProviderConfig } from '../../../src/runtime/server/utils/provider-config'
import { createRequestEvent } from '../request-event'

interface RuntimeConfig {
  oidc: { providers: Record<string, Record<string, unknown>> }
}

const runtimeConfig: RuntimeConfig = {
  oidc: {
    providers: {},
  },
}

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt's virtual imports are unavailable outside its runtime.
vi.mock('#imports', () => ({
  useRuntimeConfig: () => runtimeConfig,
}))

describe('useOidcProviderConfig', () => {
  beforeEach(() => {
    runtimeConfig.oidc.providers = {}
  })

  it('resolves configured provider defaults, endpoints, and runtime sentinels synchronously', () => {
    runtimeConfig.oidc.providers['oidc'] = {
      baseUrl: 'https://issuer.example.com',
      authorizationUrl: 'authorize',
      tokenUrl: 'token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      scope: '__NUXT_OIDC_RUNTIME_CONFIG_UNSET__',
      sessionConfiguration: {
        expirationThreshold: '__NUXT_OIDC_RUNTIME_CONFIG_UNSET__',
      },
    }

    const config = useOidcProviderConfig(createRequestEvent(), 'oidc')

    expect(config.authorizationUrl).toBe('https://issuer.example.com/authorize')
    expect(config.tokenUrl).toBe('https://issuer.example.com/token')
    expect(config.scope).toStrictEqual(['openid'])
    expect(config.sessionConfiguration).toMatchObject({
      expirationThreshold: 0,
      singleSignOut: false,
    })
    expect(JSON.stringify(config)).not.toContain('NUXT_OIDC_RUNTIME_CONFIG_UNSET')
  })

  it('rejects providers that are not configured synchronously', () => {
    expect(() => useOidcProviderConfig(createRequestEvent(), 'github')).toThrow(
      'OIDC provider "github" is not configured.',
    )
  })
})
