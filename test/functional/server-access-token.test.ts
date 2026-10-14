import type { OidcProviderConfig } from '../../src/runtime/server/utils/provider'
import type { PersistentSession } from '../../src/runtime/types'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRs256Fixture, HandlerHarness, interceptFetch } from './handler-harness'

const clientId = 'functional-client'
const issuer = 'https://identity.example.test'
const tokenUrl = `${issuer}/token`
let signingFixture: Awaited<ReturnType<typeof createRs256Fixture>>

beforeAll(async () => {
  signingFixture = await createRs256Fixture()
})

beforeEach(() => {
  vi.stubEnv('NUXT_OIDC_AUTH_SESSION_SECRET', 'test-auth-session-secret-at-least-32-characters')
  vi.stubEnv('NUXT_OIDC_SESSION_SECRET', 'test-session-secret-at-least-32-characters')
  vi.stubEnv('NUXT_OIDC_TOKEN_KEY', 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=')
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

function createHarness(providerOverrides: Partial<OidcProviderConfig> = {}) {
  return new HandlerHarness({
    runtimeConfig: {
      oidc: {
        session: { maxAge: 3600 },
        providers: {
          oidc: {
            authorizationUrl: `${issuer}/authorize`,
            clientId,
            clientSecret: 'functional-secret',
            exposeAccessToken: false,
            exposeIdToken: false,
            redirectUri: 'https://app.example.test/auth/oidc/callback',
            requiredProperties: [
              'clientId',
              'clientSecret',
              'authorizationUrl',
              'tokenUrl',
              'redirectUri',
            ],
            sessionConfiguration: { expirationThreshold: 120 },
            skipAccessTokenParsing: true,
            tokenUrl,
            validateAccessToken: false,
            validateIdToken: false,
            ...providerOverrides,
          },
        },
      },
    },
  })
}

async function signIn(harness: HandlerHarness, tokenResponses: Record<string, string>[]) {
  harness.cookieJar.seedSession('oidc', {
    codeVerifier: 'functional-code-verifier',
    redirect: 'https://app.example.test/auth/oidc/callback',
    state: 'functional-state',
  })
  let tokenResponseIndex = 0
  const interceptor = interceptFetch([
    {
      method: 'POST',
      url: tokenUrl,
      respond: () => Response.json(tokenResponses[tokenResponseIndex++]),
    },
  ])
  const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
  const callbackRequest = harness.createEvent({
    path: '/auth/oidc/callback',
    query: { code: 'functional-code', state: 'functional-state' },
  })
  await callbackHandler(callbackRequest.event)
  callbackRequest.commitResponseCookies()
  return interceptor
}

async function requestAccessToken(harness: HandlerHarness) {
  const { getAccessToken } = await import('../../src/runtime/server/utils/session')
  return await getAccessToken(harness.createEvent({ path: '/api/downstream' }).event)
}

function storedSessions(harness: HandlerHarness) {
  return [...harness.inspectStorage('oidc').values()] as PersistentSession[]
}

describe('server-side access token retrieval', () => {
  it('keeps sessions without refresh token or exposure stateless by default', async () => {
    const harness = createHarness()
    await signIn(harness, [
      {
        access_token: 'previous-access-token',
        expires_in: '3600',
        refresh_token: 'previous-refresh-token',
        token_type: 'Bearer',
      },
    ])
    expect(storedSessions(harness)).toHaveLength(1)
    vi.stubEnv('NUXT_OIDC_TOKEN_KEY', undefined)
    const storage = vi.spyOn(harness, 'storage').mockImplementation(() => {
      throw new Error('Storage unavailable')
    })

    await signIn(harness, [
      { access_token: 'stateless-access-token', expires_in: '3600', token_type: 'Bearer' },
    ])

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({
      provider: 'oidc',
      tokensStored: false,
    })
    await expect(requestAccessToken(harness)).rejects.toMatchObject({ statusCode: 401 })
    const { getPersistedIdToken } = await import('../../src/runtime/server/utils/session')
    await expect(
      getPersistedIdToken(harness.createEvent({ path: '/auth/oidc/logout' }).event),
    ).resolves.toBeUndefined()
    expect(storage).not.toHaveBeenCalled()
  })

  it('returns a stored access token without exposing tokens to the browser', async () => {
    const harness = createHarness({ storeAccessToken: true })
    const idToken = await signingFixture.sign({ aud: clientId, iss: issuer, sub: 'user-1' })
    await signIn(harness, [
      {
        access_token: 'opaque-access-token',
        expires_in: '3600',
        id_token: idToken,
        token_type: 'Bearer',
      },
    ])

    await expect(requestAccessToken(harness)).resolves.toBe('opaque-access-token')

    const sessionHandler = (await import('../../src/runtime/server/api/session.get')).default
    const browserSession = await sessionHandler(
      harness.createEvent({ path: '/api/_auth/session' }).event,
    )
    expect(browserSession).toMatchObject({ canRefresh: false, provider: 'oidc' })
    expect(browserSession).not.toHaveProperty('accessToken')
    expect(browserSession).not.toHaveProperty('idToken')
    const userSession = harness.inspectSession('nuxt-oidc-auth')
    expect(userSession?.data).not.toHaveProperty('accessToken')
    const storedSession = JSON.stringify([...harness.inspectStorage('oidc').values()])
    expect(storedSession).not.toContain('opaque-access-token')
    expect(storedSession).not.toContain(idToken)
  })

  it('returns the refreshed access token when the stored token is about to expire', async () => {
    const harness = createHarness()
    const interceptor = await signIn(harness, [
      {
        access_token: 'initial-opaque-access-token',
        expires_in: '60',
        refresh_token: 'initial-refresh-token',
        token_type: 'Bearer',
      },
      {
        access_token: 'refreshed-opaque-access-token',
        expires_in: '3600',
        refresh_token: 'rotated-refresh-token',
        token_type: 'Bearer',
      },
    ])

    await expect(requestAccessToken(harness)).resolves.toBe('refreshed-opaque-access-token')
    expect(interceptor.requests.filter((request) => request.url === tokenUrl)).toHaveLength(2)
  })

  it('rejects an expired opaque access token that cannot be refreshed', async () => {
    const harness = createHarness({ storeAccessToken: true })
    await signIn(harness, [
      { access_token: 'short-lived-access-token', expires_in: '60', token_type: 'Bearer' },
    ])
    vi.useFakeTimers({ now: Date.now() + 61_000, toFake: ['Date'] })

    await expect(requestAccessToken(harness)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rejects a valid user session without a stored access token', async () => {
    const harness = createHarness()
    const now = Math.trunc(Date.now() / 1000)
    harness.cookieJar.seedSession('nuxt-oidc-auth', {
      canRefresh: false,
      expireAt: now + 3600,
      loggedInAt: now,
      provider: 'oidc',
    })

    await expect(requestAccessToken(harness)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rejects a stored access token without a finite expiry', async () => {
    const harness = createHarness({ storeAccessToken: true })
    await signIn(harness, [
      { access_token: 'legacy-access-token', expires_in: '3600', token_type: 'Bearer' },
    ])
    for (const storedSession of storedSessions(harness)) {
      delete (storedSession as Partial<PersistentSession>).exp
    }

    await expect(requestAccessToken(harness)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rejects an unreadable access token and still signs out after a token key change', async () => {
    const harness = createHarness({
      additionalLogoutParameters: { idTokenHint: '' },
      logoutUrl: `${issuer}/logout`,
      storeAccessToken: true,
    })
    const idToken = await signingFixture.sign({ aud: clientId, iss: issuer, sub: 'user-1' })
    await signIn(harness, [
      {
        access_token: 'opaque-access-token',
        expires_in: '3600',
        id_token: idToken,
        token_type: 'Bearer',
      },
    ])
    vi.stubEnv('NUXT_OIDC_TOKEN_KEY', 'ZmVkY2JhOTg3NjU0MzIxMGZlZGNiYTk4NzY1NDMyMTA=')

    await expect(requestAccessToken(harness)).rejects.toMatchObject({ statusCode: 401 })

    const logoutHandler = (await import('../../src/runtime/server/handler/logout.get')).default
    const logoutRequest = harness.createEvent({ path: '/auth/oidc/logout' })
    await logoutHandler(logoutRequest.event)
    logoutRequest.commitResponseCookies()
    expect(logoutRequest.response).toMatchObject({
      status: 302,
      location: expect.stringMatching(`^${issuer}/logout`),
    })
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toEqual({})
    expect(storedSessions(harness)).toHaveLength(0)
  })

  it.each([
    { name: 'refresh token', refreshToken: 'refresh-token', expected: 'user-1' },
    { name: 'storeAccessToken only', refreshToken: undefined, expected: undefined },
  ])(
    'persists the single sign-out identity for $name sessions',
    async ({ refreshToken, expected }) => {
      const harness = createHarness({
        sessionConfiguration: { expirationThreshold: 120, singleSignOut: true },
        storeAccessToken: true,
      })
      const idToken = await signingFixture.sign({ aud: clientId, iss: issuer, sub: 'user-1' })
      await signIn(harness, [
        {
          access_token: 'opaque-access-token',
          expires_in: '3600',
          id_token: idToken,
          token_type: 'Bearer',
          ...(refreshToken && { refresh_token: refreshToken }),
        },
      ])

      const [storedSession] = storedSessions(harness)
      expect(storedSession?.singleSignOutId).toBe(expected)
    },
  )
})
