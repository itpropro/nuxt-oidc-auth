import type { OidcProviderConfig } from '../../src/runtime/server/utils/provider'
import type * as SecurityUtils from '../../src/runtime/server/utils/security'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRs256Fixture, HandlerHarness, interceptFetch } from './handler-harness'

const baseUrl = 'https://identity.example.test/realms/example'
const tokenUrl = `${baseUrl}/protocol/openid-connect/token`
let signingFixture: Awaited<ReturnType<typeof createRs256Fixture>>

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
})

beforeEach(() => {
  mocks.decryptToken.mockImplementation(async (token) => {
    if (token.encryptedToken === 'stored-access-token') return 'initial-access-token'
    if (token.encryptedToken === 'stored-id-token') return 'initial-id-token'
    return 'refresh-token'
  })
  mocks.encryptToken.mockResolvedValue({ encryptedToken: 'encrypted', iv: 'iv' })
  vi.stubEnv('NUXT_OIDC_SESSION_SECRET', 'test-session-secret-at-least-32-characters')
  vi.stubEnv('NUXT_OIDC_TOKEN_KEY', 'test-token-key')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

type ExposureOverrides = Pick<OidcProviderConfig, 'exposeAccessToken' | 'exposeIdToken'>

function createRuntimeConfig(overrides: Partial<ExposureOverrides>) {
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

async function seedSession(harness: HandlerHarness, sessionId: string): Promise<void> {
  const now = Math.trunc(Date.now() / 1000)
  harness.cookieJar.seedSession(
    'nuxt-oidc-auth',
    {
      provider: 'keycloak',
      canRefresh: true,
      expireAt: now + 3600,
      loggedInAt: now,
    },
    sessionId,
  )
  await harness.storage('oidc').setItem(sessionId, {
    createdAt: new Date(),
    updatedAt: new Date(),
    exp: now + 3600,
    iat: now,
    accessToken: { encryptedToken: 'stored-access-token', iv: 'iv' },
    idToken: { encryptedToken: 'stored-id-token', iv: 'iv' },
    refreshToken: { encryptedToken: 'stored-refresh-token', iv: 'iv' },
  })
}

function expectTokenExposure(
  session: { accessToken?: string; idToken?: string },
  expected: { accessToken?: string; idToken?: string },
): void {
  if (expected.accessToken) expect(session.accessToken).toBe(expected.accessToken)
  else expect(session).not.toHaveProperty('accessToken')

  if (expected.idToken) expect(session.idToken).toBe(expected.idToken)
  else expect(session).not.toHaveProperty('idToken')
}

describe('token exposure overrides', () => {
  it.each([
    {
      name: 'explicit true values',
      overrides: { exposeAccessToken: true, exposeIdToken: true },
      exposeAccessToken: true,
      exposeIdToken: true,
    },
    {
      name: 'explicit false values',
      overrides: { exposeAccessToken: false, exposeIdToken: false },
      exposeAccessToken: false,
      exposeIdToken: false,
    },
    {
      name: 'omitted values',
      overrides: {},
      exposeAccessToken: false,
      exposeIdToken: true,
    },
  ])('applies $name to initial and refreshed sessions', async (testCase) => {
    const initialHarness = new HandlerHarness({
      runtimeConfig: createRuntimeConfig(testCase.overrides),
    })
    await seedSession(initialHarness, `initial-${testCase.name}`)
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
    await seedSession(refreshHarness, `refresh-${testCase.name}`)
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
})
