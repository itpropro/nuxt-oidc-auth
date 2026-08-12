import type { UserSession } from '../../src/runtime/types'
import type * as SecurityUtils from '../../src/runtime/server/utils/security'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRs256Fixture, HandlerHarness, interceptFetch } from './handler-harness'

const tokenUrl = 'https://identity.example.test/token'
const userInfoUrl = 'https://identity.example.test/userinfo'
let signingFixture: Awaited<ReturnType<typeof createRs256Fixture>>

const mocks = vi.hoisted(() => ({
  decryptToken: vi.fn<() => Promise<string>>(),
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
  mocks.decryptToken.mockResolvedValue('refresh-token')
  mocks.encryptToken.mockResolvedValue({ encryptedToken: 'encrypted', iv: 'iv' })
  vi.stubEnv('NUXT_OIDC_SESSION_SECRET', 'test-session-secret-at-least-32-characters')
  vi.stubEnv('NUXT_OIDC_TOKEN_KEY', 'test-token-key')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

function createRuntimeConfig() {
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
          userInfoUrl,
          userNameClaim: 'preferred_username',
          optionalClaims: ['resource_access', 'department'],
          validateAccessToken: false,
          validateIdToken: false,
          requiredProperties: [
            'clientId',
            'clientSecret',
            'authorizationUrl',
            'tokenUrl',
            'redirectUri',
          ],
        },
      },
    },
  }
}

function seedAuthSession(harness: HandlerHarness): void {
  harness.cookieJar.seedSession('oidc', {
    state: 'functional-state',
    codeVerifier: 'functional-code-verifier',
    redirect: 'https://app.example.test/auth/oidc/callback',
  })
}

async function invokeCallback(harness: HandlerHarness): Promise<void> {
  const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
  const request = harness.createEvent({
    path: '/auth/oidc/callback',
    query: { code: 'functional-code', state: 'functional-state' },
  })
  await callbackHandler(request.event)
  request.commitResponseCookies()
}

describe('token-derived session replacement', () => {
  it('replaces previous identity data while preserving application session fields', async () => {
    const firstAccessToken = await signingFixture.sign({
      preferred_username: 'pgadmin',
      sub: 'admin-user',
    })
    const firstIdToken = await signingFixture.sign({
      department: 'administration',
      resource_access: { playground: { roles: ['admin-role'] } },
      sub: 'admin-user',
    })
    const secondAccessToken = await signingFixture.sign({ sub: 'regular-user' })
    const secondIdToken = await signingFixture.sign({
      resource_access: { playground: { roles: ['user-role'] } },
      sub: 'regular-user',
    })
    const tokenResponses = [
      {
        access_token: firstAccessToken,
        id_token: firstIdToken,
        token_type: 'Bearer',
        expires_in: '300',
      },
      {
        access_token: secondAccessToken,
        id_token: secondIdToken,
        token_type: 'Bearer',
        expires_in: '300',
      },
    ]
    let tokenResponseIndex = 0
    let userInfoRequestCount = 0
    const harness = new HandlerHarness({ runtimeConfig: createRuntimeConfig() })
    harness.cookieJar.seedSession('nuxt-oidc-auth', {
      provider: 'oidc',
      canRefresh: false,
      expireAt: 1,
      applicationData: { theme: 'dark' },
    })
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json(tokenResponses[tokenResponseIndex++]!),
      },
      {
        url: userInfoUrl,
        respond: () => {
          userInfoRequestCount += 1
          return userInfoRequestCount === 1
            ? Response.json({ displayName: 'Playground Admin' })
            : Response.json({ error: 'not_found' }, { status: 404 })
        },
      },
    ])

    seedAuthSession(harness)
    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({
      userName: 'pgadmin',
      userInfo: { displayName: 'Playground Admin' },
      claims: {
        department: 'administration',
        resource_access: { playground: { roles: ['admin-role'] } },
      },
    })

    seedAuthSession(harness)
    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toEqual(
      expect.objectContaining({
        provider: 'oidc',
        userName: '',
        applicationData: { theme: 'dark' },
        claims: {
          resource_access: { playground: { roles: ['user-role'] } },
        },
      }),
    )
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).not.toHaveProperty('userInfo')
  })

  it('replaces refreshed nested claims on every cycle and keeps hook output current', async () => {
    const refreshedAccessToken = await signingFixture.sign({ sub: 'regular-user' })
    const refreshedIdToken = await signingFixture.sign({
      resource_access: { playground: { roles: ['user-role'] } },
      sub: 'regular-user',
    })
    const harness = new HandlerHarness({ runtimeConfig: createRuntimeConfig() })
    const interceptor = interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({
            access_token: refreshedAccessToken,
            id_token: refreshedIdToken,
            refresh_token: 'new-refresh-token',
            token_type: 'Bearer',
            expires_in: '3600',
          }),
      },
    ])
    const sessionId = 'refresh-session'
    harness.cookieJar.seedSession(
      'nuxt-oidc-auth',
      {
        provider: 'oidc',
        canRefresh: true,
        expireAt: 1,
        loggedInAt: 1,
        updatedAt: 1,
        applicationData: { theme: 'dark' },
        claims: {
          department: 'administration',
          resource_access: { playground: { roles: ['admin-role'] } },
        },
      },
      sessionId,
    )
    await harness.storage('oidc').setItem(sessionId, {
      createdAt: new Date(),
      updatedAt: new Date(),
      exp: 1,
      iat: 1,
      accessToken: { encryptedToken: 'encrypted', iv: 'iv' },
      refreshToken: { encryptedToken: 'encrypted', iv: 'iv' },
    })
    const { refreshUserSession, sessionHooks } =
      await import('../../src/runtime/server/utils/session')
    const removeHook = sessionHooks.hook('refresh', (session) => {
      session.claims = { ...session.claims, status: 'Refresh' }
    })

    try {
      for (let cycle = 0; cycle < 2; cycle += 1) {
        const request = harness.createEvent({ path: '/api/_auth/session/refresh' })
        const session = await refreshUserSession(request.event)
        await sessionHooks.callHookParallel('refresh', session, request.event)
        request.commitResponseCookies()

        expect(session).toEqual(
          expect.objectContaining({
            provider: 'oidc',
            loggedInAt: 1,
            applicationData: { theme: 'dark' },
            claims: {
              resource_access: { playground: { roles: ['user-role'] } },
              status: 'Refresh',
            },
          }),
        )
        expect(harness.inspectSession('nuxt-oidc-auth')?.data.claims).toEqual({
          resource_access: { playground: { roles: ['user-role'] } },
        })
      }
    } finally {
      removeHook()
    }

    expect(interceptor.requests).toHaveLength(2)
  })

  it('keeps setUserSession merge behavior for external callers', async () => {
    const harness = new HandlerHarness({ runtimeConfig: createRuntimeConfig() })
    harness.cookieJar.seedSession('nuxt-oidc-auth', {
      provider: 'oidc',
      canRefresh: false,
      expireAt: 1,
      claims: { existing: 'preserved' },
      applicationData: { theme: 'dark' },
    })
    const event = harness.createEvent({ path: '/api/custom-session' })
    const { setUserSession } = await import('../../src/runtime/server/utils/session')

    await setUserSession(event.event, {
      provider: 'oidc',
      canRefresh: true,
      expireAt: 2,
      claims: { added: 'value' },
    } satisfies UserSession)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toEqual(
      expect.objectContaining({
        applicationData: { theme: 'dark' },
        claims: { added: 'value', existing: 'preserved' },
      }),
    )
  })
})
