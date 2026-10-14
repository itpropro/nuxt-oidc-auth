import type { OidcProviderConfig } from '../../src/runtime/server/utils/provider'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { oidc } from '../../src/runtime/providers'
import { resolveEffectiveProviderConfig } from '../../src/runtime/server/utils/config'
import { createRs256Fixture, HandlerHarness, interceptFetch } from './handler-harness'

const issuer = 'https://identity.example.test/tenant'
const discoveryUrl = `${issuer}/.well-known/openid-configuration`
const endpoints = {
  authorization_endpoint: 'https://login.identity.example.test/oauth2/authorize',
  token_endpoint: 'https://login.identity.example.test/oauth2/token',
  userinfo_endpoint: 'https://login.identity.example.test/oauth2/userinfo',
  end_session_endpoint: 'https://login.identity.example.test/oauth2/logout',
  jwks_uri: 'https://login.identity.example.test/oauth2/keys',
}
const clientId = 'functional-client'
let signingFixture: Awaited<ReturnType<typeof createRs256Fixture>>

beforeAll(async () => {
  signingFixture = await createRs256Fixture()
})

beforeEach(async () => {
  const { clearRemoteJwkSetCache } = await import('../../src/runtime/server/utils/security')
  clearRemoteJwkSetCache()
  vi.stubEnv('NUXT_OIDC_AUTH_SESSION_SECRET', 'test-auth-session-secret-at-least-32-characters')
  vi.stubEnv('NUXT_OIDC_SESSION_SECRET', 'test-session-secret-at-least-32-characters')
  vi.stubEnv('NUXT_OIDC_TOKEN_KEY', 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

function discoveryProviderConfig(overrides: Partial<OidcProviderConfig> = {}) {
  return {
    clientId,
    clientSecret: 'functional-secret',
    openIdConfiguration: discoveryUrl,
    redirectUri: 'https://app.example.test/auth/oidc/callback',
    skipAccessTokenParsing: true,
    validateAccessToken: false,
    ...overrides,
  } satisfies Partial<OidcProviderConfig>
}

function createHarness(provider: Partial<OidcProviderConfig>) {
  return new HandlerHarness({
    runtimeConfig: {
      oidc: {
        session: { automaticRefresh: true, expirationCheck: true, maxAge: 3600 },
        providers: { oidc: provider },
      },
    },
  })
}

function serveDiscovery(metadata: Record<string, unknown> = { issuer, ...endpoints }) {
  return {
    url: discoveryUrl,
    respond: () => Response.json(metadata),
  }
}

function discoveryRequests(requests: Request[]) {
  return requests.filter((request) => request.url === discoveryUrl)
}

async function invokeLogin(harness: HandlerHarness) {
  const loginHandler = (await import('../../src/runtime/server/handler/login.get')).default
  const request = harness.createEvent({ path: '/auth/oidc/login' })
  await loginHandler(request.event)
  request.commitResponseCookies()
  return new URL(request.response.location!, 'https://app.example.test')
}

async function invokeLogout(harness: HandlerHarness) {
  const logoutHandler = (await import('../../src/runtime/server/handler/logout.get')).default
  const request = harness.createEvent({ path: '/auth/oidc/logout' })
  await logoutHandler(request.event)
  request.commitResponseCookies()
  return new URL(request.response.location!)
}

describe('provider endpoint discovery', () => {
  it('runs login, callback, refresh, and logout from a discovery URL', async () => {
    const idToken = (sub: string) => signingFixture.sign({ aud: clientId, iss: issuer, sub })
    const tokenResponses = [
      {
        access_token: 'initial-opaque-access-token',
        expires_in: '0',
        id_token: await idToken('user-1'),
        refresh_token: 'initial-refresh-token',
        token_type: 'Bearer',
      },
      {
        access_token: 'refreshed-opaque-access-token',
        expires_in: '3600',
        id_token: await idToken('user-1'),
        refresh_token: 'rotated-refresh-token',
        token_type: 'Bearer',
      },
    ]
    let tokenResponseIndex = 0
    const harness = createHarness(discoveryProviderConfig())
    const { requests } = interceptFetch([
      serveDiscovery(),
      {
        method: 'POST',
        url: endpoints.token_endpoint,
        respond: () => Response.json(tokenResponses[tokenResponseIndex++]!),
      },
      { url: endpoints.jwks_uri, respond: () => Response.json(signingFixture.jwks) },
      { url: endpoints.userinfo_endpoint, respond: () => Response.json({ email: 'a@b.test' }) },
    ])

    const authorizationRedirect = await invokeLogin(harness)

    expect(authorizationRedirect.origin + authorizationRedirect.pathname).toBe(
      endpoints.authorization_endpoint,
    )
    expect(discoveryRequests(requests)).toHaveLength(1)

    const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
    const callbackRequest = harness.createEvent({
      path: '/auth/oidc/callback',
      query: {
        code: 'functional-code',
        state: authorizationRedirect.searchParams.get('state') || undefined,
      },
    })
    await callbackHandler(callbackRequest.event)
    callbackRequest.commitResponseCookies()

    expect(callbackRequest.response.location).toBe('/')
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toEqual(
      expect.objectContaining({ provider: 'oidc', userInfo: { email: 'a@b.test' } }),
    )
    expect(discoveryRequests(requests)).toHaveLength(2)

    const { getUserSession } = await import('../../src/runtime/server/utils/session')
    const refreshedSession = await getUserSession(
      harness.createEvent({ path: '/api/_auth/session' }).event,
      { errorBehavior: 'throw' },
    )

    expect(refreshedSession).toEqual(expect.objectContaining({ canRefresh: true }))
    expect(
      requests.filter((request) => request.url === endpoints.token_endpoint).map((r) => r.method),
    ).toEqual(['POST', 'POST'])
    expect(discoveryRequests(requests)).toHaveLength(3)

    const logoutRedirect = await invokeLogout(harness)

    expect(logoutRedirect.origin + logoutRedirect.pathname).toBe(endpoints.end_session_endpoint)
    expect(discoveryRequests(requests)).toHaveLength(4)
  })

  it('keeps explicit endpoints and empty optional endpoint opt-outs', async () => {
    const harness = createHarness(
      discoveryProviderConfig({
        authorizationUrl: 'https://login.identity.example.test/custom/authorize',
        logoutUrl: '',
      }),
    )
    interceptFetch([serveDiscovery()])

    const authorizationRedirect = await invokeLogin(harness)
    const logoutRedirect = await invokeLogout(harness)

    expect(authorizationRedirect.origin + authorizationRedirect.pathname).toBe(
      'https://login.identity.example.test/custom/authorize',
    )
    expect(logoutRedirect.href).toBe('https://app.example.test/')
  })

  it('does not start a login when discovery fails', async () => {
    const harness = createHarness(discoveryProviderConfig())
    const { requests } = interceptFetch([
      serveDiscovery({ ...endpoints, issuer: 'https://attacker.example.test/tenant' }),
    ])

    const redirect = await invokeLogin(harness)

    expect(redirect.href).toBe('https://app.example.test/')
    expect(requests.map((request) => request.url)).toEqual([discoveryUrl])
  })

  it.each([
    {
      name: 'a mismatching issuer',
      openIdConfiguration: discoveryUrl,
      respond: () => Response.json({ ...endpoints, issuer: `${issuer}/` }),
      error: `does not match the expected issuer "${issuer}"`,
    },
    {
      name: 'unavailable metadata',
      openIdConfiguration: discoveryUrl,
      respond: () => new Response('unavailable', { status: 503 }),
      error: '503',
    },
    {
      name: 'an invalid endpoint',
      openIdConfiguration: discoveryUrl,
      respond: () => Response.json({ ...endpoints, issuer, token_endpoint: 'token' }),
      error: 'invalid token_endpoint',
    },
    {
      name: 'a URL that is not an OpenID discovery URL',
      openIdConfiguration: `${issuer}/metadata`,
      respond: () => Response.json({ ...endpoints, issuer }),
      error: 'must be an absolute URL ending in /.well-known/openid-configuration',
    },
  ])('rejects $name', async ({ openIdConfiguration, respond, error }) => {
    interceptFetch([{ url: /.*/, respond }])

    await expect(
      resolveEffectiveProviderConfig(discoveryProviderConfig({ openIdConfiguration }), oidc),
    ).rejects.toThrow(error)
  })
})
