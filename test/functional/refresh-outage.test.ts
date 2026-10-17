import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { OidcProviderConfig } from '../../src/runtime/server/utils/provider'
import { encryptToken } from '../../src/runtime/server/utils/security'
import type { SessionBehaviorOptions } from '../../src/runtime/server/utils/session'
import type { FetchRoute } from './handler-harness'
import { createRs256Fixture, HandlerHarness, interceptFetch } from './handler-harness'

const issuer = 'https://identity.example.test'
const tokenUrl = `${issuer}/token`
const jwksUri = `${issuer}/jwks`
const discoveryUrl = `${issuer}/.well-known/openid-configuration`
const clientId = 'functional-client'
const clientSecret = 'refresh-outage-secret'
const tokenKey = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY='
const sessionId = 'refresh-outage-session'
const seededUserSession = {
  provider: 'oidc',
  canRefresh: true,
  expireAt: 1,
  loggedInAt: 1,
  updatedAt: 1,
}
const errorOutput: string[] = []
let signingFixture: Awaited<ReturnType<typeof createRs256Fixture>>

type TokenAnswer = () => Response

const unansweredRefreshes: { name: string; answer: TokenAnswer }[] = [
  {
    name: 'no response',
    answer: () => {
      throw new TypeError('fetch failed')
    },
  },
  {
    name: 'an interrupted HTTP 503 body',
    answer: () =>
      new Response(
        new ReadableStream({
          pull: (controller) => {
            controller.error(new TypeError('terminated'))
          },
        }),
        { status: 503 },
      ),
  },
  ...[408, 429, 500, 503].map((status) => ({
    name: `HTTP ${status}`,
    answer: () => new Response('unavailable', { status }),
  })),
]

const refusedRefreshes: { name: string; answer: TokenAnswer }[] = [
  {
    name: 'invalid_grant',
    answer: () => Response.json({ error: 'invalid_grant' }, { status: 400 }),
  },
  {
    name: 'invalid_client',
    answer: () => Response.json({ error: 'invalid_client' }, { status: 401 }),
  },
]

beforeAll(async () => {
  signingFixture = await createRs256Fixture()
})

beforeEach(async () => {
  const { clearRemoteJwkSetCache } = await import('../../src/runtime/server/utils/security')
  clearRemoteJwkSetCache()
  errorOutput.length = 0
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    errorOutput.push(String(chunk))
    return true
  })
  vi.stubEnv('NUXT_OIDC_TOKEN_KEY', tokenKey)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

// The module keeps the session settings of the first configuration it reads, so all tests share them.
function createHarness(overrides: Partial<OidcProviderConfig> = {}) {
  return new HandlerHarness({
    runtimeConfig: {
      oidc: {
        session: { automaticRefresh: true, expirationCheck: true, maxAge: 3600 },
        providers: {
          oidc: {
            clientId,
            clientSecret,
            authorizationUrl: `${issuer}/authorize`,
            tokenUrl,
            redirectUri: 'https://app.example.test/auth/oidc/callback',
            tokenRequestType: 'form-urlencoded',
            sessionConfiguration: { expirationThreshold: 300 },
            skipAccessTokenParsing: true,
            validateAccessToken: false,
            validateIdToken: false,
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
    },
  })
}

async function seedSession(
  harness: HandlerHarness,
  persistent: Record<string, unknown> = {},
  expireAt = 1,
) {
  harness.cookieJar.seedSession('nuxt-oidc-auth', { ...seededUserSession, expireAt }, sessionId)
  await harness.storage('oidc').setItem(sessionId, {
    createdAt: new Date(),
    updatedAt: new Date(),
    exp: expireAt,
    iat: 1,
    accessToken: await encryptToken('initial-access-token', tokenKey),
    refreshToken: await encryptToken('initial-refresh-token', tokenKey),
    ...persistent,
  })
  return harness.inspectStorage('oidc').get(sessionId)!
}

function refreshedTokens() {
  return Response.json({
    access_token: 'refreshed-access-token',
    expires_in: '3600',
    refresh_token: 'rotated-refresh-token',
    token_type: 'Bearer',
  })
}

function tokenRoute(answer: TokenAnswer): FetchRoute {
  return { method: 'POST', url: tokenUrl, respond: answer }
}

async function refreshTokenOf(request: Request) {
  return new URLSearchParams(await request.text()).get('refresh_token')
}

async function refresh(harness: HandlerHarness, options?: SessionBehaviorOptions) {
  const request = harness.createEvent({ path: '/api/_auth/refresh' })
  const { refreshUserSession } = await import('../../src/runtime/server/utils/session')
  const result: unknown = await refreshUserSession(request.event, options).catch(
    (error: unknown) => error,
  )
  request.commitResponseCookies()
  return { response: request.response, result }
}

function expectSessionKept(harness: HandlerHarness, persistentSession: Record<string, unknown>) {
  expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual({
    ...seededUserSession,
    expireAt: persistentSession['exp'],
  })
  expect(harness.inspectStorage('oidc').get(sessionId)).toStrictEqual(persistentSession)
}

function expectSessionCleared(harness: HandlerHarness) {
  expect(harness.inspectSession('nuxt-oidc-auth')?.data ?? {}).toStrictEqual({})
  expect(harness.inspectStorage('oidc').has(sessionId)).toBe(false)
}

async function invokeRefreshEndpoint(harness: HandlerHarness) {
  const handler = (await import('../../src/runtime/server/api/refresh.post')).default
  const request = harness.createEvent({ method: 'POST', path: '/api/_auth/refresh' })
  const result: unknown = await handler(request.event).catch((error: unknown) => error)
  request.commitResponseCookies()
  return result
}

function inSeconds(seconds: number) {
  return Math.trunc(Date.now() / 1000) + seconds
}

async function getSession(harness: HandlerHarness) {
  const request = harness.createEvent({ path: '/api/orders' })
  const { getUserSession } = await import('../../src/runtime/server/utils/session')
  const result: unknown = await getUserSession(request.event).catch((error: unknown) => error)
  request.commitResponseCookies()
  return result
}

describe('refreshes the provider does not answer', () => {
  it.each(unansweredRefreshes)(
    'keep the session after $name and refresh it once the provider answers',
    async ({ answer }) => {
      const harness = createHarness()
      const persistentSession = await seedSession(harness)
      let tokenAnswer = answer
      const interceptor = interceptFetch([tokenRoute(() => tokenAnswer())])

      const unanswered = await refresh(harness)

      expect(unanswered.result).toMatchObject({ statusCode: 503 })
      expectSessionKept(harness, persistentSession)

      tokenAnswer = refreshedTokens
      const answered = await refresh(harness)

      expect(answered.result).toStrictEqual(expect.objectContaining({ provider: 'oidc' }))
      expect(interceptor.requests).toHaveLength(2)
      await expect(Promise.all(interceptor.requests.map(refreshTokenOf))).resolves.toStrictEqual([
        'initial-refresh-token',
        'initial-refresh-token',
      ])
    },
  )

  it('answers 503 instead of redirecting with errorBehavior redirect', async () => {
    const harness = createHarness()
    const persistentSession = await seedSession(harness)
    interceptFetch([tokenRoute(() => new Response('unavailable', { status: 503 }))])

    const { response, result } = await refresh(harness, { errorBehavior: 'redirect' })

    expect(result).toMatchObject({ statusCode: 503 })
    expect(response.location).toBeUndefined()
    expectSessionKept(harness, persistentSession)
  })

  it('keeps a client secret the provider echoes out of the error and log output', async () => {
    const harness = createHarness()
    await seedSession(harness)
    interceptFetch([
      tokenRoute(() =>
        Response.json(
          { error: 'temporarily_unavailable', error_description: `echo ${clientSecret}` },
          { status: 503 },
        ),
      ),
    ])

    const { result } = await refresh(harness)

    expect(result).toMatchObject({ statusCode: 503 })
    expect(String(result)).not.toContain(clientSecret)
    expect(errorOutput.join(' ')).toContain('[REDACTED]')
    expect(errorOutput.join(' ')).not.toContain(clientSecret)
  })

  it.each(
    unansweredRefreshes.filter(
      ({ name }) =>
        name === 'no response' || name === 'an interrupted HTTP 503 body' || name === 'HTTP 503',
    ),
  )('keep the session when discovery gets $name', async ({ answer }) => {
    const harness = createHarness({
      authorizationUrl: undefined,
      openIdConfiguration: discoveryUrl,
      tokenUrl: undefined,
    })
    const persistentSession = await seedSession(harness)
    const interceptor = interceptFetch([{ url: discoveryUrl, respond: () => answer() }])

    const { result } = await refresh(harness)

    expect(result).toMatchObject({ statusCode: 503 })
    expect(interceptor.requests.every((request) => request.url === discoveryUrl)).toBe(true)
    expectSessionKept(harness, persistentSession)
  })
})

describe('refreshes the provider refuses', () => {
  it.each(refusedRefreshes)('clear the session after $name', async ({ answer }) => {
    const harness = createHarness()
    await seedSession(harness)
    interceptFetch([tokenRoute(answer)])

    const { result } = await refresh(harness)

    expect(result).toMatchObject({ statusCode: 401 })
    expectSessionCleared(harness)
  })

  it.each(refusedRefreshes)(
    'redirect after $name with errorBehavior redirect',
    async ({ answer }) => {
      const harness = createHarness()
      await seedSession(harness)
      interceptFetch([tokenRoute(answer)])

      const { response } = await refresh(harness, { errorBehavior: 'redirect' })

      expect(response.location).toBe('/')
      expectSessionCleared(harness)
    },
  )

  it('clear the session when the JWKS request fails after a token response', async () => {
    const harness = createHarness({
      openIdConfiguration: { issuer, jwks_uri: jwksUri },
      tokenValidationMode: 'strict',
      validateIdToken: true,
    })
    const originalIdToken = await signingFixture.sign({ aud: clientId, iss: issuer, sub: 'user-1' })
    await seedSession(harness, { idToken: await encryptToken(originalIdToken, tokenKey) })
    const refreshedIdToken = await signingFixture.sign({
      aud: clientId,
      iss: issuer,
      sub: 'user-1',
    })
    interceptFetch([
      tokenRoute(() =>
        Response.json({
          access_token: 'refreshed-access-token',
          expires_in: '3600',
          id_token: refreshedIdToken,
          token_type: 'Bearer',
        }),
      ),
      { url: jwksUri, respond: () => new Response('unavailable', { status: 503 }) },
    ])

    const { result } = await refresh(harness)

    expect(result).toMatchObject({ statusCode: 401 })
    expectSessionCleared(harness)
  })

  it('clear the session after invalid discovery metadata', async () => {
    const harness = createHarness({
      authorizationUrl: undefined,
      openIdConfiguration: discoveryUrl,
      tokenUrl: undefined,
    })
    await seedSession(harness)
    interceptFetch([
      {
        url: discoveryUrl,
        respond: () =>
          Response.json({
            issuer: 'https://other.example.test',
            authorization_endpoint: `${issuer}/authorize`,
            token_endpoint: tokenUrl,
          }),
      },
    ])

    const { result } = await refresh(harness)

    expect(result).toMatchObject({ statusCode: 401 })
    expectSessionCleared(harness)
  })
})

describe('early refreshes the provider does not answer', () => {
  it('return the unexpired session with tokens exposed as configured', async () => {
    const harness = createHarness({ exposeAccessToken: true })
    const persistentSession = await seedSession(harness, {}, inSeconds(120))
    const interceptor = interceptFetch([
      tokenRoute(() => new Response('unavailable', { status: 503 })),
    ])

    const session = await getSession(harness)

    expect(interceptor.requests).toHaveLength(1)
    expect(session).toStrictEqual(
      expect.objectContaining({ provider: 'oidc', accessToken: 'initial-access-token' }),
    )
    expectSessionKept(harness, persistentSession)
  })

  it('answer 503 and keep the session once the access token expired', async () => {
    const harness = createHarness()
    const persistentSession = await seedSession(harness, {}, inSeconds(-1))
    interceptFetch([tokenRoute(() => new Response('unavailable', { status: 503 }))])

    await expect(getSession(harness)).resolves.toMatchObject({ statusCode: 503 })
    expectSessionKept(harness, persistentSession)
  })

  it('answer 503 from the refresh endpoint while the access token is valid', async () => {
    const harness = createHarness()
    const persistentSession = await seedSession(harness, {}, inSeconds(600))
    const interceptor = interceptFetch([
      tokenRoute(() => new Response('unavailable', { status: 503 })),
    ])

    const result = await invokeRefreshEndpoint(harness)

    expect(interceptor.requests).toHaveLength(1)
    expect(result).toMatchObject({ statusCode: 503 })
    expectSessionKept(harness, persistentSession)
  })
})

describe('refresh endpoint', () => {
  it('passes a 503 through and keeps the session', async () => {
    const harness = createHarness()
    const persistentSession = await seedSession(harness)
    interceptFetch([tokenRoute(() => new Response('unavailable', { status: 503 }))])

    const result = await invokeRefreshEndpoint(harness)

    expect(result).toMatchObject({ statusCode: 503 })
    expectSessionKept(harness, persistentSession)
  })

  it('still answers an invalid session with an empty session', async () => {
    const harness = createHarness()
    interceptFetch([])

    await expect(invokeRefreshEndpoint(harness)).resolves.toStrictEqual({})
  })
})
