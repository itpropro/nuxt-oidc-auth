import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { OidcProviderConfig } from '../../src/runtime/server/utils/provider'
import { encryptToken } from '../../src/runtime/server/utils/security'
import { createRs256Fixture, HandlerHarness, interceptFetch } from './handler-harness'

const baseUrl = 'https://identity.example.test/realms/example'
const tokenKey = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY='
const tokenUrl = `${baseUrl}/protocol/openid-connect/token`
let signingFixture: Awaited<ReturnType<typeof createRs256Fixture>>

beforeAll(async () => {
  signingFixture = await createRs256Fixture()
})

beforeEach(() => {
  vi.stubEnv('NUXT_OIDC_SESSION_SECRET', 'test-session-secret-at-least-32-characters')
  vi.stubEnv('NUXT_OIDC_TOKEN_KEY', tokenKey)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

function createRuntimeConfig(overrides: Partial<OidcProviderConfig>) {
  return {
    oidc: {
      session: {
        maxAge: 3600,
        automaticRefresh: false,
        expirationCheck: false,
      },
      providers: {
        keycloak: {
          baseUrl,
          clientId: 'functional-client',
          clientSecret: 'functional-secret',
          redirectUri: 'https://app.example.test/auth/keycloak/callback',
          validateAccessToken: false,
          validateIdToken: false,
          ...overrides,
        },
      },
    },
  }
}

async function seedSession(harness: HandlerHarness, sessionId: string): Promise<number> {
  const now = Math.trunc(Date.now() / 1000)
  const expireAt = now + 3600
  harness.cookieJar.seedSession(
    'nuxt-oidc-auth',
    {
      provider: 'keycloak',
      canRefresh: true,
      expireAt,
      loggedInAt: now,
    },
    sessionId,
  )
  await harness.storage('oidc').setItem(sessionId, {
    createdAt: new Date(),
    updatedAt: new Date(),
    exp: now + 3600,
    iat: now,
    accessToken: await encryptToken('initial-access-token', tokenKey),
    idToken: await encryptToken('initial-id-token', tokenKey),
    refreshToken: await encryptToken('refresh-token', tokenKey),
  })
  return expireAt
}

function expectTokenExposure(
  session: { accessToken?: string; idToken?: string },
  expected: { accessToken?: string; idToken?: string },
): void {
  const tokens = Object.fromEntries(
    Object.entries(session).filter(([name]) => name === 'accessToken' || name === 'idToken'),
  )
  expect(tokens).toStrictEqual(expected)
}

describe('token exposure overrides', () => {
  it.each([
    {
      id: 'explicit-true',
      name: 'explicit true values',
      overrides: { exposeAccessToken: true, exposeIdToken: true },
      exposeAccessToken: true,
      exposeIdToken: true,
    },
    {
      id: 'explicit-false',
      name: 'explicit false values',
      overrides: { exposeAccessToken: false, exposeIdToken: false },
      exposeAccessToken: false,
      exposeIdToken: false,
    },
    {
      id: 'omitted',
      name: 'omitted values',
      overrides: {},
      exposeAccessToken: false,
      exposeIdToken: false,
    },
  ])('applies $name to initial and refreshed sessions', async (testCase) => {
    const initialHarness = new HandlerHarness({
      runtimeConfig: createRuntimeConfig(testCase.overrides),
    })
    await seedSession(initialHarness, `initial-${testCase.id}`)
    const { getUserSession, refreshUserSession } =
      await import('../../src/runtime/server/utils/session')
    const initialRequest = initialHarness.createEvent({ path: '/api/_auth/session' })
    const initialSession = await getUserSession(initialRequest.event)

    expectTokenExposure(initialSession, {
      ...(testCase.exposeAccessToken && { accessToken: 'initial-access-token' }),
      ...(testCase.exposeIdToken && { idToken: 'initial-id-token' }),
    })

    const refreshedAccessToken = await signingFixture.sign({ sub: 'user-1' })
    const refreshedIdToken = await signingFixture.sign({ sub: 'user-1' })
    const refreshHarness = new HandlerHarness({
      runtimeConfig: createRuntimeConfig(testCase.overrides),
    })
    await seedSession(refreshHarness, `refresh-${testCase.id}`)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({
            access_token: refreshedAccessToken,
            id_token: refreshedIdToken,
            refresh_token: 'rotated-refresh-token',
            token_type: 'Bearer',
            expires_in: '3600',
          }),
      },
    ])
    const refreshRequest = refreshHarness.createEvent({ path: '/api/_auth/session/refresh' })
    const refreshedSession = await refreshUserSession(refreshRequest.event)

    expectTokenExposure(refreshedSession, {
      ...(testCase.exposeAccessToken && { accessToken: refreshedAccessToken }),
      ...(testCase.exposeIdToken && { idToken: refreshedIdToken }),
    })
  })

  it.each([
    { expiresIn: undefined, name: 'omitted' },
    { expiresIn: 'not-a-number', name: 'invalid' },
  ])('preserves finite session expiry when expires_in is $name', async ({ expiresIn }) => {
    const sessionId = `refresh-expiry-${expiresIn ?? 'omitted'}`
    const harness = new HandlerHarness({
      runtimeConfig: createRuntimeConfig({ skipAccessTokenParsing: true }),
    })
    const currentExpiration = await seedSession(harness, sessionId)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({
            access_token: 'opaque-refreshed-access-token',
            refresh_token: 'rotated-refresh-token',
            token_type: 'Bearer',
            ...(expiresIn !== undefined && { expires_in: expiresIn }),
          }),
      },
    ])
    const { refreshUserSession } = await import('../../src/runtime/server/utils/session')

    const refreshedSession = await refreshUserSession(
      harness.createEvent({ path: '/api/_auth/session/refresh' }).event,
    )
    const persistentSession = harness.inspectStorage('oidc').get(sessionId)

    expect(persistentSession).toMatchObject({ exp: currentExpiration })
    expect(Number.isFinite(persistentSession?.['exp'])).toBe(true)
    expect(refreshedSession.expireAt).toBe(currentExpiration)
  })

  it('preserves zero-valued refreshed JWT timestamps', async () => {
    const sessionId = 'refresh-zero-timestamps'
    const harness = new HandlerHarness({ runtimeConfig: createRuntimeConfig({}) })
    await seedSession(harness, sessionId)
    const accessToken = await signingFixture.sign({ exp: 0, iat: 0, sub: 'user-1' })
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({
            access_token: accessToken,
            expires_in: '3600',
            refresh_token: 'rotated-refresh-token',
            token_type: 'Bearer',
          }),
      },
    ])
    const { refreshUserSession } = await import('../../src/runtime/server/utils/session')

    const refreshedSession = await refreshUserSession(
      harness.createEvent({ path: '/api/_auth/session/refresh' }).event,
    )

    expect(harness.inspectStorage('oidc').get(sessionId)).toMatchObject({ exp: 0, iat: 0 })
    expect(refreshedSession.expireAt).toBe(0)
  })
})
