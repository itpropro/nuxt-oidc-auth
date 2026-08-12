import type * as OidcUtils from '../../src/runtime/server/utils/oidc'
import { importJWK, SignJWT } from 'jose'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRs256Fixture, HandlerHarness, interceptFetch } from './handler-harness'

const tokenUrl = 'https://identity.example.test/token'
const issuer = 'https://identity.example.test'
const jwksUri = `${issuer}/jwks`
let accessToken: string
let signingFixture: Awaited<ReturnType<typeof createRs256Fixture>>

const testLogger = vi.hoisted(() => ({
  error: vi.fn<(...args: unknown[]) => void>(),
  info: vi.fn<(...args: unknown[]) => void>(),
  warn: vi.fn<(...args: unknown[]) => void>(),
}))

vi.mock('../../src/runtime/server/utils/oidc', async (importOriginal) => {
  const actual = await importOriginal<typeof OidcUtils>()
  return { ...actual, useOidcLogger: () => testLogger }
})

beforeAll(async () => {
  signingFixture = await createRs256Fixture()
  accessToken = await signingFixture.sign({ aud: 'functional-client', sub: 'user-1' })
})

beforeEach(() => {
  testLogger.error.mockClear()
  testLogger.info.mockClear()
  testLogger.warn.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function createRuntimeConfig(callbackRedirectUrl?: string) {
  return {
    oidc: {
      session: {
        maxAge: 3600,
        automaticRefresh: false,
        expirationCheck: false,
      },
      providers: {
        oidc: {
          clientId: 'functional-client',
          clientSecret: 'functional-secret',
          authorizationUrl: 'https://identity.example.test/authorize',
          tokenUrl,
          redirectUri: 'https://app.example.test/auth/oidc/callback',
          validateAccessToken: false,
          validateIdToken: false,
          requiredProperties: [
            'clientId',
            'clientSecret',
            'authorizationUrl',
            'tokenUrl',
            'redirectUri',
          ],
          ...(callbackRedirectUrl && { callbackRedirectUrl }),
        },
      },
    },
  }
}

function createStrictRuntimeConfig(overrides: Record<string, unknown> = {}) {
  return {
    oidc: {
      session: {
        maxAge: 3600,
        automaticRefresh: false,
        expirationCheck: false,
      },
      providers: {
        oidc: {
          clientId: 'functional-client',
          clientSecret: 'functional-secret',
          authorizationUrl: `${issuer}/authorize`,
          tokenUrl,
          redirectUri: 'https://app.example.test/auth/oidc/callback',
          audience: 'functional-api',
          tokenValidationMode: 'strict',
          validateAccessToken: true,
          validateIdToken: false,
          openIdConfiguration: { issuer, jwks_uri: jwksUri },
          requiredProperties: [
            'clientId',
            'clientSecret',
            'authorizationUrl',
            'tokenUrl',
            'redirectUri',
          ],
          ...overrides,
        },
      },
    },
  }
}

function seedCallbackSession(harness: HandlerHarness) {
  harness.cookieJar.seedSession('oidc', {
    state: 'functional-state',
    nonce: 'functional-nonce',
    codeVerifier: 'functional-code-verifier',
    redirect: 'https://app.example.test/auth/oidc/callback',
  })
}

async function invokeCallback(harness: HandlerHarness) {
  const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
  const request = harness.createEvent({
    path: '/auth/oidc/callback',
    query: { code: 'functional-code', state: 'functional-state' },
  })
  await callbackHandler(request.event)
  return request
}

describe('callback handler redirects', () => {
  it.each([
    {
      name: 'uses the dynamic auth-session redirect after clearing temporary state',
      sessionCallbackRedirectUrl: '/account/security?reauthenticated=true',
      expectedRedirectUrl: '/account/security?reauthenticated=true',
    },
    {
      name: 'prefers an explicitly configured redirect',
      configuredCallbackRedirectUrl: '/signed-in',
      sessionCallbackRedirectUrl: '/account/security',
      expectedRedirectUrl: '/signed-in',
    },
    {
      name: 'falls back to the application root',
      expectedRedirectUrl: '/',
    },
    {
      name: 'rejects a backslash redirect path',
      sessionCallbackRedirectUrl: '/\\attacker.example/path',
      expectedRedirectUrl: '/',
    },
    {
      name: 'rejects a tab-normalized redirect path',
      sessionCallbackRedirectUrl: '/\t/attacker.example/path',
      expectedRedirectUrl: '/',
    },
  ])(
    '$name',
    async ({ configuredCallbackRedirectUrl, expectedRedirectUrl, sessionCallbackRedirectUrl }) => {
      const harness = new HandlerHarness({
        runtimeConfig: createRuntimeConfig(configuredCallbackRedirectUrl),
      })
      harness.cookieJar.seedSession('oidc', {
        state: 'functional-state',
        nonce: 'functional-nonce',
        codeVerifier: 'functional-code-verifier',
        redirect: 'https://app.example.test/auth/oidc/callback',
        callbackRedirectUrl: sessionCallbackRedirectUrl,
        referer: 'https://app.example.test/start',
      })
      const interceptor = interceptFetch([
        {
          method: 'POST',
          url: tokenUrl,
          respond: () =>
            Response.json({
              access_token: accessToken,
              token_type: 'Bearer',
              expires_in: '300',
            }),
        },
      ])
      const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
      const request = harness.createEvent({
        path: '/auth/oidc/callback',
        query: { code: 'functional-code', state: 'functional-state' },
      })

      await callbackHandler(request.event)

      expect(request.response).toMatchObject({ status: 302, location: expectedRedirectUrl })
      expect(harness.inspectSession('oidc')).toMatchObject({
        clearCount: 1,
        data: {},
        operations: ['clear'],
      })
      expect(request.response.headers['set-cookie']).toEqual(
        expect.arrayContaining(['oidc=; Max-Age=0; Path=/']),
      )
      request.commitResponseCookies()
      expect(harness.cookieJar.get('oidc')).toBeUndefined()
      expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({
        provider: 'oidc',
      })
      expect(interceptor.requests).toHaveLength(1)
    },
  )

  it('does not authenticate a Keycloak public client with a secret', async () => {
    let tokenRequestAuthorization: string | null = null
    let tokenRequestBody: URLSearchParams | undefined
    const harness = new HandlerHarness({
      runtimeConfig: {
        oidc: {
          session: {
            maxAge: 3600,
            automaticRefresh: false,
            expirationCheck: false,
          },
          providers: {
            keycloak: {
              authenticationScheme: 'none',
              baseUrl: 'https://identity.example.test/realms/example',
              clientId: 'functional-client',
              exposeIdToken: false,
              pkce: true,
              redirectUri: 'https://app.example.test/auth/keycloak/callback',
              tokenUrl,
              userInfoUrl: '',
              validateAccessToken: false,
              validateIdToken: false,
            },
          },
        },
      },
    })
    harness.cookieJar.seedSession('oidc', {
      nonce: 'functional-nonce',
      codeVerifier: 'functional-code-verifier',
      redirect: 'https://app.example.test/auth/keycloak/callback',
    })
    const interceptor = interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: async (request) => {
          tokenRequestAuthorization = request.headers.get('authorization')
          tokenRequestBody = new URLSearchParams(await request.text())
          return Response.json({
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: '300',
          })
        },
      },
    ])
    const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
    const request = harness.createEvent({
      path: '/auth/keycloak/callback',
      query: { code: 'functional-code' },
    })

    await callbackHandler(request.event)

    expect(request.response).toMatchObject({ status: 302, location: '/' })
    expect(interceptor.requests).toHaveLength(1)
    expect(tokenRequestAuthorization).toBeNull()
    expect(tokenRequestBody?.get('client_id')).toBe('functional-client')
    expect(tokenRequestBody?.get('code_verifier')).toBe('functional-code-verifier')
    expect(tokenRequestBody?.has('client_secret')).toBe(false)
  })
})

describe('callback token validation', () => {
  it('validates strict access tokens even when their decoded audience does not match', async () => {
    const wrongAudienceToken = await signingFixture.sign({
      aud: 'functional-client',
      iss: issuer,
      sub: 'user-1',
    })
    const harness = new HandlerHarness({ runtimeConfig: createStrictRuntimeConfig() })
    seedCallbackSession(harness)
    const interceptor = interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: wrongAudienceToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(interceptor.requests.map((request) => request.url)).toContain(jwksUri)
    expect(harness.inspectSession('nuxt-oidc-auth')).toMatchObject({ data: {} })
  })

  it('validates enabled ID tokens independently from disabled access-token validation', async () => {
    const idToken = await signingFixture.sign({
      aud: 'functional-client',
      iss: issuer,
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        validateAccessToken: false,
        validateIdToken: true,
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({ access_token: accessToken, id_token: idToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({ provider: 'oidc' })
  })

  it('fails strict validation when enabled ID token is missing', async () => {
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        validateAccessToken: false,
        validateIdToken: true,
      }),
    })
    seedCallbackSession(harness)
    const interceptor = interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: accessToken, token_type: 'Bearer' }),
      },
    ])

    await invokeCallback(harness)

    expect(interceptor.requests).toHaveLength(1)
    expect(harness.inspectSession('nuxt-oidc-auth')).toMatchObject({ data: {} })
  })

  it('requires exp in strict mode', async () => {
    const privateKey = await importJWK(signingFixture.privateJwk, 'RS256')
    const tokenWithoutExpiration = await new SignJWT({
      aud: 'functional-api',
      iss: issuer,
      sub: 'user-1',
    })
      .setProtectedHeader({ alg: 'RS256', kid: signingFixture.privateJwk.kid })
      .setIssuedAt()
      .sign(privateKey)
    const harness = new HandlerHarness({ runtimeConfig: createStrictRuntimeConfig() })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({ access_token: tokenWithoutExpiration, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')).toMatchObject({ data: {} })
  })

  it.each([
    { name: 'issuer', openIdConfiguration: { jwks_uri: jwksUri } },
    {
      name: 'non-empty issuer array',
      openIdConfiguration: { issuer: [issuer, ' '], jwks_uri: jwksUri },
    },
    { name: 'jwks_uri', openIdConfiguration: { issuer } },
  ])('requires discovery $name in strict mode', async ({ openIdConfiguration }) => {
    const strictAccessToken = await signingFixture.sign({
      aud: 'functional-api',
      iss: issuer,
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({ openIdConfiguration }),
    })
    seedCallbackSession(harness)
    const interceptor = interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: strictAccessToken, token_type: 'Bearer' }),
      },
    ])

    await invokeCallback(harness)

    expect(interceptor.requests).toHaveLength(1)
    expect(harness.inspectSession('nuxt-oidc-auth')).toMatchObject({ data: {} })
  })

  it('accepts strict discovery issuer arrays', async () => {
    const strictAccessToken = await signingFixture.sign({
      aud: 'functional-api',
      iss: issuer,
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        openIdConfiguration: { issuer: [issuer, `${issuer}/tenant`], jwks_uri: jwksUri },
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: strictAccessToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({ provider: 'oidc' })
  })

  it('preserves legacy issuer arrays when validating tokens', async () => {
    const wrongIssuerToken = await signingFixture.sign({
      aud: 'functional-client',
      iss: 'https://attacker.example.test',
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        openIdConfiguration: { issuer: [issuer, `${issuer}/tenant`], jwks_uri: jwksUri },
        tokenValidationMode: 'legacy',
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: wrongIssuerToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')).toMatchObject({ data: {} })
  })

  it('preserves malformed legacy issuer arrays for fail-closed validation', async () => {
    const wrongIssuerToken = await signingFixture.sign({
      aud: 'functional-client',
      iss: 'https://attacker.example.test',
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        openIdConfiguration: { issuer: [issuer, ' '], jwks_uri: jwksUri },
        tokenValidationMode: 'legacy',
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: wrongIssuerToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')).toMatchObject({ data: {} })
  })

  it('rejects mixed-type legacy issuer arrays instead of dropping issuer validation', async () => {
    const matchingToken = await signingFixture.sign({
      aud: 'functional-client',
      iss: issuer,
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        openIdConfiguration: {
          issuer: [issuer, undefined] as unknown as string[],
          jwks_uri: jwksUri,
        },
        tokenValidationMode: 'legacy',
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: matchingToken, token_type: 'Bearer' }),
      },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')).toMatchObject({ data: {} })
  })

  it('does not inspect malformed decoded audiences before strict validation', async () => {
    const privateKey = await importJWK(signingFixture.privateJwk, 'RS256')
    const malformedAudienceToken = await new SignJWT({
      aud: 42 as unknown as string,
      iss: issuer,
      sub: 'user-1',
    })
      .setProtectedHeader({ alg: 'RS256', kid: signingFixture.privateJwk.kid })
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey)
    const harness = new HandlerHarness({ runtimeConfig: createStrictRuntimeConfig() })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({ access_token: malformedAudienceToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await expect(invokeCallback(harness)).resolves.toBeDefined()

    expect(harness.inspectSession('nuxt-oidc-auth')).toMatchObject({ data: {} })
  })

  it('preserves legacy validation without exp and matches array audiences by exact member', async () => {
    const privateKey = await importJWK(signingFixture.privateJwk, 'RS256')
    const legacyToken = await new SignJWT({
      aud: ['another-audience', 'functional-client'],
      iss: issuer,
      sub: 'user-1',
    })
      .setProtectedHeader({ alg: 'RS256', kid: signingFixture.privateJwk.kid })
      .setIssuedAt()
      .sign(privateKey)
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        tokenValidationMode: 'legacy',
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: legacyToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({ provider: 'oidc' })
  })

  it('preserves shared legacy audience gating for every enabled token type', async () => {
    const matchingAccessToken = await signingFixture.sign({
      aud: 'functional-client',
      iss: issuer,
      sub: 'user-1',
    })
    const invalidIdToken = await signingFixture.sign({
      aud: 'unmatched-audience',
      iss: 'https://attacker.example.test',
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        tokenValidationMode: 'legacy',
        validateAccessToken: true,
        validateIdToken: true,
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({
            access_token: matchingAccessToken,
            id_token: invalidIdToken,
            token_type: 'Bearer',
          }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')).toMatchObject({ data: {} })
  })

  it('uses exact legacy string audience matching and warns once per provider', async () => {
    const similarAudienceToken = await signingFixture.sign({
      aud: 'prefix-functional-client-suffix',
      sub: 'user-1',
    })
    const runtimeConfig = createRuntimeConfig()
    runtimeConfig.oidc.providers.oidc.validateAccessToken = true

    for (let requestNumber = 0; requestNumber < 2; requestNumber += 1) {
      const harness = new HandlerHarness({ runtimeConfig })
      seedCallbackSession(harness)
      interceptFetch([
        {
          method: 'POST',
          url: tokenUrl,
          respond: () =>
            Response.json({ access_token: similarAudienceToken, token_type: 'Bearer' }),
        },
      ])
      await invokeCallback(harness)
      expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({ provider: 'oidc' })
    }

    expect(testLogger.warn).toHaveBeenCalledTimes(1)
    expect(testLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("tokenValidationMode: 'strict'"),
    )
    expect(testLogger.warn.mock.calls[0]?.join(' ')).not.toContain(similarAudienceToken)
  })
})
