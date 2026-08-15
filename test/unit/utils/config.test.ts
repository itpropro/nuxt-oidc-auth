/**
 * Configuration Utility Tests
 *
 * Tests for configuration merging behavior using defu.
 * These tests verify the behavior of the defu library which is used
 * throughout the module for configuration merging.
 */

import type { ModuleOptions } from '../../../src/module'
import { defu } from 'defu'
import { describe, expect, it } from 'vitest'
import {
  auth0,
  cognito,
  entra,
  github,
  keycloak,
  logto,
  microsoft,
  oidc,
  zitadel,
} from '../../../src/runtime/providers'
import {
  createProviderRuntimeConfig,
  hasExplicitProviderConfig,
  replaceInjectedParameters,
  resolveProviderConfig,
  validateConfig,
  validateProviderConfig,
} from '../../../src/runtime/server/utils/config'
import { resolveCallbackRedirectUrl } from '../../../src/runtime/server/utils/redirect'
import { snakeCase } from '../../../src/runtime/server/utils/string'

const publicKeycloakConfig = {
  authenticationScheme: 'none',
  baseUrl: 'https://issuer.example.com/realms/example',
  clientId: 'public-client',
  redirectUri: 'https://app.example.com/auth/keycloak/callback',
} satisfies NonNullable<ModuleOptions['providers']['keycloak']>

const publicZitadelConfig = {
  baseUrl: 'https://issuer.example.com',
  clientId: 'public-client',
  redirectUri: 'https://app.example.com/auth/zitadel/callback',
} satisfies NonNullable<ModuleOptions['providers']['zitadel']>

function parseBoolean(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

describe('configuration Utilities', () => {
  describe('configuration merging', () => {
    it('should merge simple objects', () => {
      const defaults = { a: 1, b: 2 }
      const overrides = { b: 3, c: 4 }

      const result = defu(overrides, defaults)

      expect(result).toEqual({ a: 1, b: 3, c: 4 })
    })

    it('should preserve undefined values from defaults', () => {
      const defaults = { a: 1, b: undefined }
      const overrides = { c: 3 }

      const result = defu(overrides, defaults)

      expect(result.a).toBe(1)
      expect(result.b).toBeUndefined()
      expect(result.c).toBe(3)
    })

    it('should merge nested objects', () => {
      const defaults = {
        session: {
          maxAge: 3600,
          secure: true,
        },
        provider: 'oidc',
      }

      const overrides = {
        session: {
          maxAge: 7200,
        },
      }

      const result = defu(overrides, defaults)

      expect(result.session.maxAge).toBe(7200)
      expect(result.session.secure).toBe(true)
      expect(result.provider).toBe('oidc')
    })

    it('should handle arrays correctly', () => {
      const defaults = {
        scopes: ['openid', 'profile'],
      }

      const overrides = {
        scopes: ['openid', 'email'],
      }

      const result = defu(overrides, defaults)

      expect(result.scopes).toEqual(['openid', 'email', 'openid', 'profile'])
    })

    it('should handle null values', () => {
      const defaults = { a: 1, b: 2 }
      const overrides = { a: null }

      const result = defu(overrides, defaults)

      expect(result.a).toBe(1)
      expect(result.b).toBe(2)
    })
  })

  describe('provider configuration validation patterns', () => {
    it('should validate required provider fields', () => {
      const providerConfig = {
        clientId: 'test-client',
        clientSecret: 'test-secret',
        baseUrl: 'https://example.com',
      }

      const requiredFields = ['clientId', 'clientSecret', 'baseUrl']
      const result = validateConfig(providerConfig, requiredFields)

      expect(result.valid).toBe(true)
      expect(result.missingProperties).toEqual([])
    })

    it('should detect missing required fields', () => {
      const incompleteConfig = {
        clientId: 'test-client',
        baseUrl: 'https://example.com',
      }

      const requiredFields = ['clientId', 'clientSecret', 'baseUrl']
      const result = validateConfig(incompleteConfig, requiredFields)

      expect(result.valid).toBe(false)
      expect(result.missingProperties).toContain('clientSecret')
    })

    it('should detect empty and whitespace-only required values', () => {
      const incompleteConfig = {
        clientId: '   ',
        clientSecret: null,
        baseUrl: '',
      }

      const requiredFields = ['clientId', 'clientSecret', 'baseUrl']
      const result = validateConfig(incompleteConfig, requiredFields)

      expect(result.valid).toBe(false)
      expect(result.missingProperties).toEqual(
        expect.arrayContaining(['clientId', 'clientSecret', 'baseUrl']),
      )
    })

    it('should allow required boolean and numeric values', () => {
      const config = {
        enabled: false,
        retries: 0,
      }

      const requiredFields = ['enabled', 'retries']
      const result = validateConfig(config, requiredFields)

      expect(result.valid).toBe(true)
      expect(result.missingProperties).toEqual([])
    })

    it('should validate URL format using URL constructor', () => {
      const validUrls = ['https://example.com', 'http://localhost:8080']
      const invalidUrls = ['not-a-url', '']

      for (const url of validUrls) {
        expect(() => new URL(url)).not.toThrow()
      }

      for (const url of invalidUrls) {
        expect(() => new URL(url)).toThrow()
      }
    })

    it('should validate scope arrays', () => {
      const validScopes = ['openid', 'profile']
      const emptyScopes: string[] = []
      const invalidScopes = ['openid', '']

      expect(Array.isArray(validScopes) && validScopes.length > 0).toBe(true)
      expect(validScopes.every((s) => typeof s === 'string' && s.length > 0)).toBe(true)

      expect(emptyScopes.length > 0).toBe(false)
      expect(invalidScopes.every((s) => s.length > 0)).toBe(false)
    })
  })

  describe('resolved provider configuration', () => {
    it('defaults token validation mode to legacy and preserves runtime overrides', () => {
      expect(resolveProviderConfig({}, oidc).tokenValidationMode).toBe('legacy')
      expect(
        resolveProviderConfig(
          createProviderRuntimeConfig({ tokenValidationMode: 'strict' }, oidc),
          oidc,
        ).tokenValidationMode,
      ).toBe('strict')
    })

    it('rejects an invalid runtime token validation mode', () => {
      const config = resolveProviderConfig({}, oidc)
      Object.assign(config, { tokenValidationMode: 'unsupported' })

      expect(validateProviderConfig(config)).toMatchObject({
        valid: false,
        missingProperties: expect.arrayContaining(['tokenValidationMode']),
      })
    })

    it('requires strict access-token audience and discovery configuration', () => {
      const config = resolveProviderConfig(
        {
          clientId: 'strict-client',
          clientSecret: 'strict-secret',
          authorizationUrl: 'https://issuer.example.com/authorize',
          tokenUrl: 'https://issuer.example.com/token',
          redirectUri: 'https://app.example.com/auth/oidc/callback',
          tokenValidationMode: 'strict',
          validateAccessToken: true,
          validateIdToken: false,
        },
        oidc,
      )

      expect(validateProviderConfig(config)).toMatchObject({
        valid: false,
        missingProperties: expect.arrayContaining(['audience', 'openIdConfiguration']),
      })
    })

    it('does not require an access-token audience when only strict ID validation is enabled', () => {
      const config = resolveProviderConfig(
        {
          clientId: 'strict-client',
          clientSecret: 'strict-secret',
          authorizationUrl: 'https://issuer.example.com/authorize',
          tokenUrl: 'https://issuer.example.com/token',
          redirectUri: 'https://app.example.com/auth/oidc/callback',
          tokenValidationMode: 'strict',
          validateAccessToken: false,
          validateIdToken: true,
          openIdConfiguration: {
            issuer: 'https://issuer.example.com',
            jwks_uri: 'https://issuer.example.com/jwks',
          },
        },
        oidc,
      )

      expect(validateProviderConfig(config)).toMatchObject({ valid: true, missingProperties: [] })
    })

    it('replaces empty configured placeholders with Nuxt runtime overrides before derivation', () => {
      const configuredProvider = {
        baseUrl: '',
        clientId: '',
        clientSecret: '',
        redirectUri: '',
      }
      const runtimeProvider = {
        ...createProviderRuntimeConfig(configuredProvider, keycloak),
        baseUrl: 'https://runtime.example.com/realms/example',
        clientId: 'runtime-client',
        clientSecret: 'runtime-secret',
        redirectUri: 'https://app.example.com/auth/keycloak/callback',
      }
      const config = resolveProviderConfig(runtimeProvider, keycloak)

      expect(config.authorizationUrl).toBe(
        'https://runtime.example.com/realms/example/protocol/openid-connect/auth',
      )
      expect(config.tokenUrl).toBe(
        'https://runtime.example.com/realms/example/protocol/openid-connect/token',
      )
      expect(config.userInfoUrl).toBe(
        'https://runtime.example.com/realms/example/protocol/openid-connect/userinfo',
      )
      expect(config.logoutUrl).toBe(
        'https://runtime.example.com/realms/example/protocol/openid-connect/logout',
      )
      expect(validateProviderConfig(config).valid).toBe(true)
    })

    it('keeps omitted preset keys available for Nuxt runtime environment overrides', () => {
      const inlineRuntimeProvider = createProviderRuntimeConfig(
        {
          baseUrl: 'https://configured.example.com/realms/example',
          clientId: 'configured-client',
          clientSecret: 'configured-secret',
          redirectUri: 'https://app.example.com/auth/keycloak/callback',
        },
        keycloak,
      )
      expect(Object.hasOwn(inlineRuntimeProvider, 'authorizationUrl')).toBe(true)

      const environmentResolvedProvider = {
        ...inlineRuntimeProvider,
        authorizationUrl: 'https://runtime.example.com/authorize',
      }
      const config = resolveProviderConfig(environmentResolvedProvider, keycloak)

      expect(config.authorizationUrl).toBe('https://runtime.example.com/authorize')
      expect(config.tokenUrl).toBe(
        'https://configured.example.com/realms/example/protocol/openid-connect/token',
      )
    })

    it('keeps the complete serializable provider schema in Nitro runtime config', () => {
      const runtimeProvider = createProviderRuntimeConfig({}, oidc)

      expect(Object.keys(runtimeProvider).sort()).toEqual(
        [
          'additionalAuthParameters',
          'additionalLogoutParameters',
          'additionalTokenParameters',
          'allowedCallbackRedirectUrls',
          'allowedClientAuthParameters',
          'audience',
          'authenticationScheme',
          'authorizationUrl',
          'baseUrl',
          'callbackRedirectUrl',
          'clientId',
          'clientSecret',
          'encodeRedirectUri',
          'excludeOfflineScopeFromTokenRequest',
          'exposeAccessToken',
          'exposeIdToken',
          'filterUserInfo',
          'grantType',
          'ignoreProxyCertificateErrors',
          'logoutRedirectParameterName',
          'logoutRedirectUri',
          'logoutUrl',
          'nonce',
          'openIdConfiguration',
          'optionalClaims',
          'pkce',
          'prompt',
          'proxy',
          'redirectUri',
          'requiredProperties',
          'responseMode',
          'responseType',
          'scope',
          'scopeInTokenRequest',
          'sessionConfiguration',
          'skipAccessTokenParsing',
          'state',
          'tokenRequestType',
          'tokenUrl',
          'tokenValidationMode',
          'userInfoUrl',
          'userNameClaim',
          'validateAccessToken',
          'validateIdToken',
        ].sort(),
      )
      expect(Object.keys(runtimeProvider.sessionConfiguration || {}).sort()).toEqual(
        [
          'automaticRefresh',
          'cookieName',
          'expirationCheck',
          'expirationThreshold',
          'maxAuthSessionAge',
          'missingPersistentSession',
          'singleSignOut',
          'singleSignOutIdField',
        ].sort(),
      )
    })

    it.each([
      ['auth0', auth0],
      ['cognito', cognito],
      ['logto', logto],
      ['zitadel', zitadel],
      ['oidc', oidc],
    ] as const)('keeps runtime-only baseUrl available for %s', (_, preset) => {
      expect(createProviderRuntimeConfig({}, preset)).toHaveProperty('baseUrl')
    })

    it('keeps provider-specific nested and top-level runtime keys', () => {
      const auth0Runtime = createProviderRuntimeConfig({}, auth0)
      const entraRuntime = createProviderRuntimeConfig({}, entra)
      const microsoftRuntime = createProviderRuntimeConfig({}, microsoft)

      for (const key of ['audience', 'connection', 'invitation', 'loginHint', 'organization']) {
        expect(auth0Runtime.additionalAuthParameters).toHaveProperty(key)
        expect(auth0Runtime.additionalLogoutParameters).toHaveProperty(key)
        expect(auth0Runtime.additionalTokenParameters).toHaveProperty(key)
      }
      for (const key of [
        'audience',
        'domainHint',
        'loginHint',
        'logoutHint',
        'prompt',
        'resource',
      ]) {
        expect(entraRuntime.additionalAuthParameters).toHaveProperty(key)
        expect(entraRuntime.additionalLogoutParameters).toHaveProperty(key)
        expect(entraRuntime.additionalTokenParameters).toHaveProperty(key)
      }
      expect(microsoftRuntime).toHaveProperty('tenantId')

      expect(
        resolveProviderConfig(
          {
            ...auth0Runtime,
            additionalAuthParameters: { connection: 'github' },
          },
          auth0,
        ).additionalAuthParameters,
      ).toMatchObject({ connection: 'github' })
      expect(
        resolveProviderConfig(
          {
            ...microsoftRuntime,
            tenantId: 'runtime-tenant',
          },
          microsoft,
        ),
      ).toHaveProperty('tenantId', 'runtime-tenant')
    })

    it('preserves falsy scalar, array, object, boolean, and nested runtime overrides', () => {
      const config = resolveProviderConfig(
        {
          ...createProviderRuntimeConfig({}, oidc),
          additionalAuthParameters: {},
          allowedCallbackRedirectUrls: [],
          callbackRedirectUrl: '',
          exposeAccessToken: false,
          openIdConfiguration: {},
          scope: [],
          sessionConfiguration: {
            automaticRefresh: false,
            expirationThreshold: 0,
            singleSignOut: false,
          },
        },
        oidc,
      )

      expect(config.additionalAuthParameters).toEqual({})
      expect(config.allowedCallbackRedirectUrls).toEqual([])
      expect(config.callbackRedirectUrl).toBe('')
      expect(config.exposeAccessToken).toBe(false)
      expect(config.openIdConfiguration).toEqual({})
      expect(config.scope).toEqual([])
      expect(config.sessionConfiguration).toMatchObject({
        automaticRefresh: false,
        expirationThreshold: 0,
        singleSignOut: false,
      })
    })

    it('keeps function presets outside runtime overrides while accepting discovery objects', () => {
      const runtimeProvider = createProviderRuntimeConfig({}, auth0)

      expect(resolveProviderConfig(runtimeProvider, auth0).openIdConfiguration).toBeTypeOf(
        'function',
      )
      expect(
        resolveProviderConfig(
          {
            ...runtimeProvider,
            openIdConfiguration: {
              issuer: 'https://runtime.example.com',
              jwks_uri: 'https://runtime.example.com/jwks',
            },
          },
          auth0,
        ).openIdConfiguration,
      ).toEqual({
        issuer: 'https://runtime.example.com',
        jwks_uri: 'https://runtime.example.com/jwks',
      })
    })

    it('keeps omitted callback redirects distinct from explicit defaults', () => {
      const omittedRuntimeProvider = createProviderRuntimeConfig({}, oidc)
      const explicitRuntimeProvider = createProviderRuntimeConfig(
        { callbackRedirectUrl: '/' },
        oidc,
      )

      expect(hasExplicitProviderConfig(omittedRuntimeProvider, 'callbackRedirectUrl')).toBe(false)
      expect(
        resolveCallbackRedirectUrl({
          configuredCallbackRedirectUrl: resolveProviderConfig(omittedRuntimeProvider, oidc)
            .callbackRedirectUrl,
          hasConfiguredCallbackRedirectUrl: hasExplicitProviderConfig(
            omittedRuntimeProvider,
            'callbackRedirectUrl',
          ),
          sessionCallbackRedirectUrl: '/protected',
        }),
      ).toBe('/protected')
      expect(
        resolveCallbackRedirectUrl({
          configuredCallbackRedirectUrl: resolveProviderConfig(explicitRuntimeProvider, oidc)
            .callbackRedirectUrl,
          hasConfiguredCallbackRedirectUrl: hasExplicitProviderConfig(
            explicitRuntimeProvider,
            'callbackRedirectUrl',
          ),
          sessionCallbackRedirectUrl: '/protected',
        }),
      ).toBe('/')
    })

    it('keeps explicit endpoint overrides ahead of derived endpoints', () => {
      const config = resolveProviderConfig(
        {
          baseUrl: 'https://runtime.example.com/realms/example',
          clientId: 'runtime-client',
          clientSecret: 'runtime-secret',
          redirectUri: 'https://app.example.com/auth/keycloak/callback',
          authorizationUrl: 'https://login.example.com/authorize',
          tokenUrl: 'https://login.example.com/token',
        },
        keycloak,
      )

      expect(config.authorizationUrl).toBe('https://login.example.com/authorize')
      expect(config.tokenUrl).toBe('https://login.example.com/token')
    })

    it('derives configured relative endpoints from runtime baseUrl', () => {
      const config = resolveProviderConfig(
        {
          authorizationUrl: 'authorize',
          baseUrl: 'https://runtime.example.com/tenant',
          tokenUrl: 'token',
        },
        oidc,
      )

      expect(config.authorizationUrl).toBe('https://runtime.example.com/tenant/authorize')
      expect(config.tokenUrl).toBe('https://runtime.example.com/tenant/token')
    })

    it.each([
      { name: 'omitted', clientSecret: undefined },
      { name: 'empty', clientSecret: '' },
    ])('accepts an $name client secret for Zitadel public clients', ({ clientSecret }) => {
      const runtimeProvider = {
        ...createProviderRuntimeConfig({}, zitadel),
        baseUrl: 'https://issuer.example.com',
        clientId: 'public-client',
        redirectUri: 'https://app.example.com/auth/zitadel/callback',
        ...(clientSecret !== undefined && { clientSecret }),
      }
      const config = resolveProviderConfig(runtimeProvider, zitadel)

      expect(config.authenticationScheme).toBe('none')
      expect(config.pkce).toBe(true)
      expect(config.sessionConfiguration?.automaticRefresh).toBe(true)
      expect(validateProviderConfig(config)).toMatchObject({ valid: true, missingProperties: [] })
    })

    it.each([
      { name: 'omitted', clientSecret: undefined },
      { name: 'empty', clientSecret: '' },
    ])(
      'accepts an $name client secret for an explicit Keycloak public client',
      ({ clientSecret }) => {
        const config = resolveProviderConfig(
          {
            ...publicKeycloakConfig,
            ...(clientSecret !== undefined && { clientSecret }),
          },
          keycloak,
        )

        expect(config.requiredProperties).toContain('clientSecret')
        expect(config.authenticationScheme).toBe('none')
        expect(validateProviderConfig(config)).toMatchObject({ valid: true, missingProperties: [] })
      },
    )

    it('allows provider input types to omit public-client secrets', () => {
      expect(publicKeycloakConfig).not.toHaveProperty('clientSecret')
      expect(publicZitadelConfig).not.toHaveProperty('clientSecret')
    })

    it.each(['header', 'body'] as const)(
      'rejects a blank resolved secret for confidential %s authentication',
      (authenticationScheme) => {
        const config = resolveProviderConfig(
          {
            authenticationScheme,
            baseUrl: 'https://issuer.example.com/realms/example',
            clientId: 'confidential-client',
            clientSecret: '   ',
            redirectUri: 'https://app.example.com/auth/keycloak/callback',
          },
          keycloak,
        )

        expect(validateProviderConfig(config)).toMatchObject({
          valid: false,
          missingProperties: expect.arrayContaining(['clientSecret']),
        })
      },
    )

    it('restores provider defaults after runtime config serialization', () => {
      const serializedRuntimeProvider = JSON.parse(
        JSON.stringify(
          createProviderRuntimeConfig(
            {
              baseUrl: 'https://issuer.example.com',
              clientId: 'public-client',
              redirectUri: 'https://app.example.com/auth/zitadel/callback',
            },
            zitadel,
          ),
        ),
      ) as Parameters<typeof resolveProviderConfig>[0]
      const config = resolveProviderConfig(serializedRuntimeProvider, zitadel)

      expect(config.requiredProperties).toEqual(expect.any(Array))
      expect(config.authenticationScheme).toBe('none')
      expect(config.pkce).toBe(true)
      expect(config.sessionConfiguration?.automaticRefresh).toBe(true)
      expect(validateProviderConfig(config).valid).toBe(true)
    })

    it('preserves explicit empty optional endpoint overrides', () => {
      const config = resolveProviderConfig({ userInfoUrl: '' }, github)

      expect(config.userInfoUrl).toBe('')
    })

    it('rejects unresolved values after defaults and runtime config are resolved', () => {
      const config = resolveProviderConfig(
        {
          baseUrl: '   ',
          clientId: '',
          redirectUri: 'https://app.example.com/auth/keycloak/callback',
        },
        keycloak,
      )

      expect(validateProviderConfig(config)).toMatchObject({
        valid: false,
        missingProperties: expect.arrayContaining(['baseUrl', 'clientId', 'clientSecret']),
      })
    })

    it('does not mutate provider preset parameters between resolutions', () => {
      const first = resolveProviderConfig(
        {
          baseUrl: 'https://first.example.com',
          clientId: 'first-client',
          redirectUri: 'https://app.example.com/auth/zitadel/callback',
        },
        zitadel,
      )
      const second = resolveProviderConfig(
        {
          baseUrl: 'https://second.example.com',
          clientId: 'second-client',
          redirectUri: 'https://app.example.com/auth/zitadel/callback',
        },
        zitadel,
      )

      expect(first.additionalLogoutParameters?.clientId).toBe('first-client')
      expect(second.additionalLogoutParameters?.clientId).toBe('second-client')
      expect(zitadel.additionalLogoutParameters?.clientId).toBe('{clientId}')
    })

    it('keeps provider auth-session duration runtime-overridable', () => {
      const runtimeProvider = createProviderRuntimeConfig({}, oidc)
      const sessionConfiguration = runtimeProvider.sessionConfiguration as Record<string, unknown>

      expect(sessionConfiguration).toHaveProperty('maxAuthSessionAge')
      sessionConfiguration.maxAuthSessionAge = 90

      expect(resolveProviderConfig(runtimeProvider, oidc).sessionConfiguration).toMatchObject({
        maxAuthSessionAge: 90,
      })
    })
  })

  describe('environment variable parsing patterns', () => {
    it('should parse boolean string values', () => {
      expect(parseBoolean('true')).toBe(true)
      expect(parseBoolean('1')).toBe(true)
      expect(parseBoolean('false')).toBe(false)
      expect(parseBoolean('0')).toBe(false)
      expect(parseBoolean(undefined)).toBe(false)
    })

    it('should parse numeric environment variables', () => {
      expect(Number.parseInt('3600', 10)).toBe(3600)
      expect(Number.parseInt('0', 10)).toBe(0)
      expect(Number.isNaN(Number.parseInt('invalid', 10))).toBe(true)
    })

    it('should parse array environment variables', () => {
      const value = 'openid,profile,email'
      const result = value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      expect(result).toEqual(['openid', 'profile', 'email'])
    })

    it('should handle spaced array values', () => {
      const value = '  spaced , items  '
      const result = value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      expect(result).toEqual(['spaced', 'items'])
    })
  })

  describe('snakeCase replacement behavior', () => {
    it('should convert camelCase keys to snake_case', () => {
      expect(snakeCase('clientId')).toBe('client_id')
      expect(snakeCase('singleSignOutIdField')).toBe('single_sign_out_id_field')
    })

    it('should use values from resolved provider config for injected parameters', () => {
      const providerOptions = {
        clientId: 'runtime-client-id',
      } as Parameters<typeof replaceInjectedParameters>[1]
      const providerPreset = {
        additionalAuthParameters: {
          audience: '{clientId}',
        },
      } as Parameters<typeof replaceInjectedParameters>[2]

      replaceInjectedParameters(['clientId'], providerOptions, providerPreset)

      expect(providerOptions.additionalAuthParameters?.audience).toBe('runtime-client-id')
    })
  })
})
