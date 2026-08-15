import type { H3Event } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeConfig = {
  oidc: {
    providers: {} as Record<string, Record<string, unknown>>,
  },
}

vi.mock('#imports', () => ({
  useRuntimeConfig: () => runtimeConfig,
}))

import { useOidcProviderConfig } from '../../../src/runtime/server/utils/provider-config'

describe('useOidcProviderConfig', () => {
  beforeEach(() => {
    runtimeConfig.oidc.providers = {}
  })

  it('resolves configured provider defaults, endpoints, and runtime sentinels', () => {
    runtimeConfig.oidc.providers.oidc = {
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

    const config = useOidcProviderConfig({} as H3Event, 'oidc')

    expect(config.authorizationUrl).toBe('https://issuer.example.com/authorize')
    expect(config.tokenUrl).toBe('https://issuer.example.com/token')
    expect(config.scope).toEqual(['openid'])
    expect(config.sessionConfiguration).toMatchObject({
      expirationThreshold: 0,
      singleSignOut: false,
    })
    expect(JSON.stringify(config)).not.toContain('NUXT_OIDC_RUNTIME_CONFIG_UNSET')
  })

  it('rejects providers that are not configured', () => {
    expect(() => useOidcProviderConfig({} as H3Event, 'github')).toThrow(
      'OIDC provider "github" is not configured.',
    )
  })
})
