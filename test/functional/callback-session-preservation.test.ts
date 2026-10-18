import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { OidcProviderConfig } from '../../src/runtime/server/utils/provider'
import { encryptToken } from '../../src/runtime/server/utils/security'
import { createRs256Fixture, HandlerHarness, interceptFetch } from './handler-harness'

const issuer = 'https://identity.example.test'
const tokenKey = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY='
const tokenUrl = `${issuer}/token`
const jwksUri = `${issuer}/jwks`
let accessToken: string
let wrongNonceIdToken: string
let signingFixture: Awaited<ReturnType<typeof createRs256Fixture>>
let untrustedSigningFixture: Awaited<ReturnType<typeof createRs256Fixture>>

beforeAll(async () => {
  signingFixture = await createRs256Fixture()
  untrustedSigningFixture = await createRs256Fixture()
  accessToken = await signingFixture.sign({ aud: 'functional-client', iss: issuer, sub: 'user-1' })
  wrongNonceIdToken = await signingFixture.sign({ nonce: 'wrong-nonce', sub: 'user-1' })
})

beforeEach(() => {
  vi.stubEnv('NUXT_OIDC_SESSION_SECRET', 'test-session-secret-at-least-32-characters')
  vi.stubEnv('NUXT_OIDC_TOKEN_KEY', tokenKey)
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
        expirationCheck: true,
        missingPersistentSession: 'silent',
      },
      providers: {
        oidc: {
          clientId: 'functional-client',
          clientSecret: 'functional-secret',
          authorizationUrl: `${issuer}/authorize`,
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
          sessionConfiguration: {
            automaticRefresh: false,
            expirationCheck: true,
          },
          ...overrides,
        },
      },
    },
  }
}

function seedAuthSession(harness: HandlerHarness): void {
  harness.cookieJar.seedSession('oidc', {
    state: 'functional-state',
    nonce: 'functional-nonce',
    codeVerifier: 'functional-code-verifier',
    redirect: 'https://app.example.test/auth/oidc/callback',
  })
}

function seedCurrentSession(
  harness: HandlerHarness,
  options: { canRefresh?: boolean; expireAt?: number } = {},
): string {
  const sessionId = 'current-user-session'
  harness.cookieJar.seedSession(
    'nuxt-oidc-auth',
    {
      provider: 'oidc',
      canRefresh: options.canRefresh ?? false,
      expireAt: options.expireAt ?? Math.trunc(Date.now() / 1000) + 3600,
    },
    sessionId,
  )
  return sessionId
}

async function invokeCallback(
  harness: HandlerHarness,
  query: Record<string, string> = {},
): Promise<ReturnType<HandlerHarness['createEvent']>> {
  const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
  const request = harness.createEvent({ path: '/auth/oidc/callback', query })
  await callbackHandler(request.event)
  return request
}

async function establishRefreshableSession(harness: HandlerHarness): Promise<string> {
  seedAuthSession(harness)
  interceptFetch([
    {
      method: 'POST',
      url: tokenUrl,
      respond: () =>
        Response.json({
          access_token: accessToken,
          refresh_token: 'refresh-token',
          token_type: 'Bearer',
          expires_in: '3600',
        }),
    },
  ])
  const request = await invokeCallback(harness, {
    code: 'functional-code',
    state: 'functional-state',
  })
  request.commitResponseCookies()
  const session = harness.inspectSession('nuxt-oidc-auth')
  expect(session?.data).toMatchObject({ provider: 'oidc', canRefresh: true })
  expect(harness.inspectStorage('oidc').has(session!.id)).toBe(true)
  return session!.id
}

function expectCurrentSessionKept(
  harness: HandlerHarness,
  request: ReturnType<HandlerHarness['createEvent']>,
): void {
  expect(request.response).toMatchObject({ status: 302, location: '/' })
  expect(harness.inspectSession('nuxt-oidc-auth')).toMatchObject({
    clearCount: 0,
    data: { provider: 'oidc' },
  })
  expect(request.response.headers['set-cookie']).toStrictEqual(['oidc=; Max-Age=0; Path=/'])
}

describe('stale callback session preservation', () => {
  it('redirects a preserved session inside a custom application base', async () => {
    const harness = new HandlerHarness({
      runtimeConfig: {
        ...createRuntimeConfig(),
        app: { baseURL: '/prefix/' },
      },
    })
    seedCurrentSession(harness)

    const request = await invokeCallback(harness)

    expect(request.response).toMatchObject({ status: 302, location: '/prefix/' })
  })

  it('redirects callback errors inside a custom application base', async () => {
    const harness = new HandlerHarness({
      runtimeConfig: {
        ...createRuntimeConfig(),
        app: { baseURL: '/prefix/' },
      },
    })

    const request = await invokeCallback(harness)

    expect(request.response).toMatchObject({ status: 302, location: '/prefix/' })
  })

  it.each<{ name: string; query: Record<string, string> }>([
    { name: 'missing code without an error', query: {} },
    {
      name: 'expired authentication flow',
      query: {
        error: 'temporarily_unavailable',
        error_description: 'authentication_expired',
      },
    },
  ])('preserves a refreshable session after $name', async ({ query }) => {
    const harness = new HandlerHarness({ runtimeConfig: createRuntimeConfig() })
    const sessionId = await establishRefreshableSession(harness)

    const staleRequest = await invokeCallback(harness, query)

    expect(staleRequest.response).toMatchObject({ status: 302, location: '/' })
    expect(harness.inspectSession('nuxt-oidc-auth')).toMatchObject({
      id: sessionId,
      clearCount: 0,
      data: { provider: 'oidc', canRefresh: true },
    })
    expect(harness.inspectStorage('oidc').has(sessionId)).toBe(true)
    expect(staleRequest.response.headers['set-cookie']).toBeUndefined()
  })

  it('preserves a valid non-refreshable session without persistent storage', async () => {
    const harness = new HandlerHarness({ runtimeConfig: createRuntimeConfig() })
    seedCurrentSession(harness)

    const request = await invokeCallback(harness)

    expect(request.response).toMatchObject({ status: 302, location: '/' })
    expect(harness.inspectSession('nuxt-oidc-auth')).toMatchObject({
      clearCount: 0,
      data: { provider: 'oidc', canRefresh: false },
    })
  })

  it.each([
    { name: 'missing persistent storage', canRefresh: true },
    {
      name: 'expired cookie session',
      canRefresh: false,
      expireAt: Math.trunc(Date.now() / 1000) - 1,
    },
  ])('leaves a stale callback session with $name to session validation', async (options) => {
    const harness = new HandlerHarness({ runtimeConfig: createRuntimeConfig() })
    seedCurrentSession(harness, options)

    const request = await invokeCallback(harness)

    expectCurrentSessionKept(harness, request)
  })

  it('leaves a stale callback session with expired persistent storage to session validation', async () => {
    const harness = new HandlerHarness({ runtimeConfig: createRuntimeConfig() })
    const sessionId = seedCurrentSession(harness, { canRefresh: true })
    await harness.storage('oidc').setItem(sessionId, {
      createdAt: new Date(),
      updatedAt: new Date(),
      exp: Math.trunc(Date.now() / 1000) - 1,
      iat: Math.trunc(Date.now() / 1000) - 3600,
      accessToken: await encryptToken('initial-access-token', tokenKey),
    })

    const request = await invokeCallback(harness)

    expectCurrentSessionKept(harness, request)
    expect(harness.inspectStorage('oidc').has(sessionId)).toBe(true)
  })
})

describe('callback failures keep the established session', () => {
  it.each<{ code?: string; description: string; error: string }>([
    { error: 'access_denied', description: 'user_cancelled' },
    { error: 'server_error', description: 'unknown_failure' },
    { error: 'temporarily_unavailable', description: 'different_failure' },
    {
      code: 'unexpected-code',
      error: 'temporarily_unavailable',
      description: 'authentication_expired',
    },
  ])('keeps the current session for $error', async ({ code, description, error }) => {
    const harness = new HandlerHarness({ runtimeConfig: createRuntimeConfig() })
    seedCurrentSession(harness)

    const request = await invokeCallback(harness, {
      ...(code !== undefined && { code }),
      error,
      error_description: description,
    })

    expectCurrentSessionKept(harness, request)
  })

  it('keeps the current session after a state mismatch', async () => {
    const harness = new HandlerHarness({ runtimeConfig: createRuntimeConfig() })
    seedCurrentSession(harness)
    seedAuthSession(harness)

    const request = await invokeCallback(harness, { code: 'functional-code', state: 'wrong-state' })

    expectCurrentSessionKept(harness, request)
  })

  it('keeps the current session after a nonce mismatch', async () => {
    const harness = new HandlerHarness({ runtimeConfig: createRuntimeConfig() })
    seedCurrentSession(harness)
    seedAuthSession(harness)

    const request = await invokeCallback(harness, { id_token: wrongNonceIdToken })

    expectCurrentSessionKept(harness, request)
  })

  it('keeps the current session after a malformed hybrid ID token', async () => {
    const harness = new HandlerHarness({ runtimeConfig: createRuntimeConfig() })
    seedCurrentSession(harness)
    seedAuthSession(harness)

    const request = await invokeCallback(harness, { id_token: 'not-a-jwt' })

    expectCurrentSessionKept(harness, request)
  })

  it('keeps the current session after a token request failure', async () => {
    const harness = new HandlerHarness({ runtimeConfig: createRuntimeConfig() })
    seedCurrentSession(harness)
    seedAuthSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json(
            { error: 'invalid_grant', error_description: 'expired authorization code' },
            { status: 400 },
          ),
      },
    ])

    const request = await invokeCallback(harness, {
      code: 'functional-code',
      state: 'functional-state',
    })

    expectCurrentSessionKept(harness, request)
  })

  it('keeps the current session after token validation fails', async () => {
    const harness = new HandlerHarness({
      runtimeConfig: createRuntimeConfig({
        audience: 'functional-api',
        tokenValidationMode: 'strict',
        validateAccessToken: true,
        openIdConfiguration: { issuer, jwks_uri: jwksUri },
      }),
    })
    seedCurrentSession(harness)
    seedAuthSession(harness)
    const untrustedAccessToken = await untrustedSigningFixture.sign({
      aud: 'functional-api',
      iss: issuer,
      sub: 'user-1',
    })
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: untrustedAccessToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    const request = await invokeCallback(harness, {
      code: 'functional-code',
      state: 'functional-state',
    })

    expectCurrentSessionKept(harness, request)
  })
})
