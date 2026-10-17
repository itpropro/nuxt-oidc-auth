import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { encryptToken } from '../../src/runtime/server/utils/security'
import { createRs256Fixture, interceptFetch } from './handler-harness'
import {
  clientId,
  clientSecret,
  createHarness,
  discoveryUrl,
  expectSessionCleared,
  expectSessionKept,
  getSession,
  inSeconds,
  invokeRefreshEndpoint,
  issuer,
  jwksUri,
  refresh,
  refreshedTokens,
  refreshTokenOf,
  seedSession,
  tokenKey,
  tokenRoute,
  tokenUrl,
} from './refresh-harness'

const errorOutput: string[] = []
let signingFixture: Awaited<ReturnType<typeof createRs256Fixture>>

type ProviderAnswer = () => Response

const unansweredRefreshes: { name: string; answer: ProviderAnswer }[] = [
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

const refusedRefreshes: { name: string; answer: ProviderAnswer }[] = [
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
