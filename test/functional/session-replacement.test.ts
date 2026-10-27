import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { encryptToken } from '../../src/runtime/server/utils/security'
import type { UserSession } from '../../src/runtime/types'
import { createRs256Fixture, HandlerHarness, interceptFetch } from './handler-harness'

const tokenKey = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY='
const tokenUrl = 'https://identity.example.test/token'
const userInfoUrl = 'https://identity.example.test/userinfo'
let signingFixture: Awaited<ReturnType<typeof createRs256Fixture>>

beforeAll(async () => {
  signingFixture = await createRs256Fixture()
})

beforeEach(() => {
  vi.stubEnv('NUXT_OIDC_AUTH_SESSION_SECRET', 'test-auth-session-secret-at-least-32-characters')
  vi.stubEnv('NUXT_OIDC_SESSION_SECRET', 'test-session-secret-at-least-32-characters')
  vi.stubEnv('NUXT_OIDC_TOKEN_KEY', tokenKey)
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
  harness.cookieJar.seedSession('__Host-oidc', {
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

async function signTokens(subject: string) {
  return {
    access_token: await signingFixture.sign({ preferred_username: subject, sub: subject }),
    id_token: await signingFixture.sign({ sub: subject }),
    refresh_token: `${subject}-refresh-token`,
    token_type: 'Bearer',
    expires_in: '300',
  }
}

async function signIn(
  harness: HandlerHarness,
  tokenResponse: Record<string, string>,
  userInfo: Record<string, unknown> = {},
) {
  interceptFetch([
    { method: 'POST', url: tokenUrl, respond: () => Response.json(tokenResponse) },
    { url: userInfoUrl, respond: () => Response.json(userInfo) },
  ])
  seedAuthSession(harness)
  const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
  const request = harness.createEvent({
    path: '/auth/oidc/callback',
    query: { code: 'functional-code', state: 'functional-state' },
  })
  await callbackHandler(request.event)
  request.commitResponseCookies()
  return request.response
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
      accessToken: 'previous-access-token',
      idToken: 'previous-id-token',
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

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual(
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
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).not.toHaveProperty('accessToken')
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).not.toHaveProperty('idToken')
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
        accessToken: 'previous-access-token',
        idToken: 'previous-id-token',
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
      accessToken: await encryptToken('initial-access-token', tokenKey),
      refreshToken: await encryptToken('refresh-token', tokenKey),
    })
    const { refreshUserSession, sessionHooks } =
      await import('../../src/runtime/server/utils/session')
    const removeHook = sessionHooks.hook('refresh', (session) => {
      session.claims = { ...session.claims, status: 'Refresh' }
    })

    try {
      for (let cycle = 0; cycle < 2; cycle += 1) {
        const request = harness.createEvent({ path: '/api/_auth/session/refresh' })
        // oxlint-disable-next-line eslint/no-await-in-loop -- Each refresh consumes the session persisted by the preceding cycle.
        const session = await refreshUserSession(request.event)
        // oxlint-disable-next-line eslint/no-await-in-loop -- The hook must receive this refresh result before its cookies are committed.
        await sessionHooks.callHookParallel('refresh', session, request.event)
        request.commitResponseCookies()

        expect(session).toStrictEqual(
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
        expect(harness.inspectSession('nuxt-oidc-auth')?.data['claims']).toStrictEqual({
          resource_access: { playground: { roles: ['user-role'] } },
        })
        expect(harness.inspectSession('nuxt-oidc-auth')?.data).not.toHaveProperty('accessToken')
        expect(harness.inspectSession('nuxt-oidc-auth')?.data).not.toHaveProperty('idToken')
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

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual(
      expect.objectContaining({
        applicationData: { theme: 'dark' },
        claims: { added: 'value', existing: 'preserved' },
      }),
    )
  })
})

describe('session rotation after authentication', () => {
  const sessionName = 'nuxt-oidc-auth'

  function requestWithCookie(harness: HandlerHarness, cookie: string) {
    return harness.createEvent({ path: '/api/orders', cookies: { [sessionName]: cookie } }).event
  }

  it('rotates the session when the same account signs in again without stored tokens', async () => {
    const harness = new HandlerHarness({ runtimeConfig: createRuntimeConfig() })
    const { refresh_token: _refreshToken, ...statelessTokens } = await signTokens('account-a')

    await signIn(harness, statelessTokens)
    const firstCookie = harness.cookieJar.get(sessionName)!
    await signIn(harness, statelessTokens)
    const secondCookie = harness.cookieJar.get(sessionName)!

    expect(secondCookie).not.toBe(firstCookie)
    expect(harness.inspectStorage('oidc').size).toBe(0)
    expect(harness.inspectSession(sessionName)).toMatchObject({
      id: secondCookie,
      data: { provider: 'oidc', userName: 'account-a', tokensStored: false },
    })
  })

  it('keeps the established session when the new session cookie would be too large', async () => {
    const harness = new HandlerHarness({ runtimeConfig: createRuntimeConfig() })
    const accountA = await signTokens('account-a')
    await signIn(harness, accountA)
    const cookieA = harness.cookieJar.get(sessionName)!
    const sessionA = harness.cookieJar.findSession(sessionName, cookieA)
    const recordA = structuredClone(harness.inspectStorage('oidc').get(cookieA))

    const response = await signIn(harness, await signTokens('account-b'), {
      profile: 'x'.repeat(4096),
    })

    expect(response).toMatchObject({ status: 302, location: '/' })
    expect(response.headers['set-cookie']).not.toStrictEqual(
      expect.arrayContaining([expect.stringMatching(new RegExp(`^${sessionName}=`, 'u'))]),
    )
    expect(harness.cookieJar.get(sessionName)).toBe(cookieA)
    expect(harness.cookieJar.findSession(sessionName, cookieA)).toStrictEqual(sessionA)
    expect([...harness.inspectStorage('oidc').keys()]).toStrictEqual([cookieA])
    expect(harness.inspectStorage('oidc').get(cookieA)).toStrictEqual(recordA)
    const { getAccessToken } = await import('../../src/runtime/server/utils/session')
    await expect(getAccessToken(requestWithCookie(harness, cookieA))).resolves.toBe(
      accountA.access_token,
    )
  })
})
