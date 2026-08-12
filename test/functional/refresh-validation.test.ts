import type * as SecurityUtils from '../../src/runtime/server/utils/security'
import type { OidcProviderConfig } from '../../src/runtime/server/utils/provider'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRs256Fixture, HandlerHarness, interceptFetch } from './handler-harness'

const issuer = 'https://identity.example.test'
const tokenUrl = `${issuer}/token`
const jwksUri = `${issuer}/jwks`
const clientId = 'functional-client'
const audience = 'functional-api'
let signingFixture: Awaited<ReturnType<typeof createRs256Fixture>>
let untrustedSigningFixture: Awaited<ReturnType<typeof createRs256Fixture>>

const mocks = vi.hoisted(() => ({
  decryptToken: vi.fn<(token: { encryptedToken: string }) => Promise<string>>(),
  encryptToken: vi.fn<() => Promise<{ encryptedToken: string; iv: string }>>(),
}))

vi.mock('../../src/runtime/server/utils/security', async (importOriginal) => {
  const actual = await importOriginal<typeof SecurityUtils>()
  return {
    ...actual,
    decryptToken: mocks.decryptToken,
    encryptToken: mocks.encryptToken,
  }
})

beforeAll(async () => {
  signingFixture = await createRs256Fixture()
  untrustedSigningFixture = await createRs256Fixture()
})

beforeEach(() => {
  mocks.decryptToken.mockResolvedValue('refresh-token')
  mocks.encryptToken.mockResolvedValue({ encryptedToken: 'encrypted', iv: 'iv' })
  vi.stubEnv('NUXT_OIDC_SESSION_SECRET', 'test-session-secret-at-least-32-characters')
  vi.stubEnv('NUXT_OIDC_TOKEN_KEY', 'test-token-key')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

function createRuntimeConfig(overrides: Partial<OidcProviderConfig> = {}) {
  return {
    oidc: {
      session: {
        maxAge: 3600,
        automaticRefresh: false,
        expirationCheck: false,
      },
      providers: {
        oidc: {
          clientId,
          clientSecret: 'functional-secret',
          authorizationUrl: `${issuer}/authorize`,
          tokenUrl,
          redirectUri: 'https://app.example.test/auth/oidc/callback',
          audience,
          tokenValidationMode: 'strict',
          validateAccessToken: true,
          validateIdToken: true,
          openIdConfiguration: { issuer, jwks_uri: jwksUri },
          optionalClaims: ['role'],
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

async function invokeRefresh(
  tokenResponse: Record<string, unknown>,
  overrides: Partial<OidcProviderConfig> = {},
  originalSubject: string | null = 'user-1',
) {
  const harness = new HandlerHarness({ runtimeConfig: createRuntimeConfig(overrides) })
  const sessionId = 'refresh-validation-session'
  const originalIdToken = originalSubject
    ? await signingFixture.sign({ aud: clientId, iss: issuer, sub: originalSubject })
    : undefined
  mocks.decryptToken.mockImplementation(async (token) =>
    token.encryptedToken === 'encrypted-id-token' && originalIdToken
      ? originalIdToken
      : 'refresh-token',
  )
  harness.cookieJar.seedSession(
    'nuxt-oidc-auth',
    {
      provider: 'oidc',
      canRefresh: true,
      expireAt: 1,
      loggedInAt: 1,
      updatedAt: 1,
      claims: { role: 'old-role' },
    },
    sessionId,
  )
  await harness.storage('oidc').setItem(sessionId, {
    createdAt: new Date(),
    updatedAt: new Date(),
    exp: 1,
    iat: 1,
    accessToken: { encryptedToken: 'encrypted', iv: 'iv' },
    ...(originalIdToken && { idToken: { encryptedToken: 'encrypted-id-token', iv: 'iv' } }),
    refreshToken: { encryptedToken: 'encrypted', iv: 'iv' },
  })
  const interceptor = interceptFetch([
    {
      method: 'POST',
      url: tokenUrl,
      respond: () => Response.json(tokenResponse),
    },
    { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
  ])
  const request = harness.createEvent({ path: '/api/_auth/session/refresh' })
  const { refreshUserSession } = await import('../../src/runtime/server/utils/session')
  const result = await refreshUserSession(request.event).catch((error: unknown) => error)

  return { harness, interceptor, result, sessionId }
}

async function validTokenResponse() {
  return {
    access_token: await signingFixture.sign({ aud: audience, iss: issuer, sub: 'user-1' }),
    id_token: await signingFixture.sign({
      aud: clientId,
      iss: issuer,
      role: 'current-role',
      sub: 'user-1',
    }),
    refresh_token: 'rotated-refresh-token',
    token_type: 'Bearer',
    expires_in: '3600',
  }
}

describe('strict refresh token validation', () => {
  it('validates refreshed JWTs before updating session state', async () => {
    const { harness, result, sessionId } = await invokeRefresh(await validTokenResponse())

    expect(result).toEqual(
      expect.objectContaining({
        provider: 'oidc',
        claims: { role: 'current-role' },
      }),
    )
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toEqual(
      expect.objectContaining({ claims: { role: 'current-role' } }),
    )
    expect(harness.inspectStorage('oidc').has(sessionId)).toBe(true)
  })

  it.each([
    {
      name: 'access token signature',
      createResponse: async () => ({
        ...(await validTokenResponse()),
        access_token: await untrustedSigningFixture.sign({
          aud: audience,
          iss: issuer,
          sub: 'user-1',
        }),
      }),
    },
    {
      name: 'access token issuer',
      createResponse: async () => ({
        ...(await validTokenResponse()),
        access_token: await signingFixture.sign({
          aud: audience,
          iss: 'https://attacker.example.test',
          sub: 'user-1',
        }),
      }),
    },
    {
      name: 'access token expiration',
      createResponse: async () => ({
        ...(await validTokenResponse()),
        access_token: await signingFixture.sign({
          aud: audience,
          exp: 0,
          iss: issuer,
          sub: 'user-1',
        }),
      }),
    },
    {
      name: 'access token audience',
      createResponse: async () => ({
        ...(await validTokenResponse()),
        access_token: await signingFixture.sign({ aud: clientId, iss: issuer, sub: 'user-1' }),
      }),
    },
    {
      name: 'ID token audience',
      createResponse: async () => ({
        ...(await validTokenResponse()),
        id_token: await signingFixture.sign({ aud: audience, iss: issuer, sub: 'user-1' }),
      }),
    },
    {
      name: 'ID token signature',
      createResponse: async () => ({
        ...(await validTokenResponse()),
        id_token: await untrustedSigningFixture.sign({ aud: clientId, iss: issuer, sub: 'user-1' }),
      }),
    },
    {
      name: 'ID token issuer',
      createResponse: async () => ({
        ...(await validTokenResponse()),
        id_token: await signingFixture.sign({
          aud: clientId,
          iss: 'https://attacker.example.test',
          sub: 'user-1',
        }),
      }),
    },
    {
      name: 'ID token expiration',
      createResponse: async () => ({
        ...(await validTokenResponse()),
        id_token: await signingFixture.sign({ aud: clientId, exp: 0, iss: issuer, sub: 'user-1' }),
      }),
    },
    {
      name: 'ID token subject',
      createResponse: async () => ({
        ...(await validTokenResponse()),
        id_token: await signingFixture.sign({ aud: clientId, iss: issuer, sub: 'other-user' }),
      }),
    },
  ])('clears the session after rejecting an invalid $name', async ({ createResponse }) => {
    const { harness, result, sessionId } = await invokeRefresh(await createResponse())

    expect(result).toMatchObject({ statusCode: 401 })
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toEqual({})
    expect(harness.inspectStorage('oidc').has(sessionId)).toBe(false)
  })

  it('requires an enabled ID token in the refresh response', async () => {
    const { id_token: _, ...response } = await validTokenResponse()

    const { harness, result, sessionId } = await invokeRefresh(response)

    expect(result).toMatchObject({ statusCode: 401 })
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toEqual({})
    expect(harness.inspectStorage('oidc').has(sessionId)).toBe(false)
  })

  it('requires the original ID token subject before strict refresh validation', async () => {
    const { harness, result, sessionId } = await invokeRefresh(await validTokenResponse(), {}, null)

    expect(result).toMatchObject({ statusCode: 401 })
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toEqual({})
    expect(harness.inspectStorage('oidc').has(sessionId)).toBe(false)
  })

  it('supports an opaque access token while validating the ID token', async () => {
    const response = await validTokenResponse()
    response.access_token = 'opaque-access-token'

    const { harness, result } = await invokeRefresh(response, {
      skipAccessTokenParsing: true,
      validateAccessToken: false,
    })

    expect(result).toEqual(
      expect.objectContaining({
        provider: 'oidc',
        claims: { role: 'current-role' },
      }),
    )
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).not.toEqual({})
  })

  it.each([
    {
      name: 'missing',
      createResponse: async () => {
        const { access_token: _, ...response } = await validTokenResponse()
        return response
      },
    },
    {
      name: 'empty',
      createResponse: async () => ({ ...(await validTokenResponse()), access_token: '' }),
    },
    {
      name: 'non-string',
      createResponse: async () => ({ ...(await validTokenResponse()), access_token: {} }),
    },
  ])('rejects a $name opaque access token', async ({ createResponse }) => {
    const { harness, result, sessionId } = await invokeRefresh(await createResponse(), {
      skipAccessTokenParsing: true,
      validateAccessToken: false,
    })

    expect(result).toMatchObject({ statusCode: 401 })
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toEqual({})
    expect(harness.inspectStorage('oidc').has(sessionId)).toBe(false)
  })

  it('preserves legacy refresh parsing without signature validation', async () => {
    const response = await validTokenResponse()
    response.access_token = await untrustedSigningFixture.sign({
      aud: audience,
      iss: issuer,
      sub: 'user-1',
    })
    response.id_token = await untrustedSigningFixture.sign({
      aud: clientId,
      iss: issuer,
      role: 'legacy-role',
      sub: 'user-1',
    })

    const { interceptor, result } = await invokeRefresh(response, {
      tokenValidationMode: 'legacy',
    })

    expect(result).toEqual(
      expect.objectContaining({ claims: { role: 'legacy-role' }, provider: 'oidc' }),
    )
    expect(interceptor.requests.map((request) => request.url)).toEqual([tokenUrl])
  })
})
