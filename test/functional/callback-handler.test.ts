import { importJWK, SignJWT } from 'jose'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { startFaultOidcProvider } from '../setup/fault-oidc-provider'
import { createRs256Fixture, HandlerHarness, interceptFetch } from './handler-harness'

const tokenUrl = 'https://identity.example.test/token'
const issuer = 'https://identity.example.test'
const jwksUri = `${issuer}/jwks`
let accessToken: string
let signingFixture: Awaited<ReturnType<typeof createRs256Fixture>>
let untrustedSigningFixture: Awaited<ReturnType<typeof createRs256Fixture>>

const errorOutput: string[] = []

beforeAll(async () => {
  signingFixture = await createRs256Fixture()
  untrustedSigningFixture = await createRs256Fixture()
  accessToken = await signingFixture.sign({ aud: 'functional-client', sub: 'user-1' })
})

beforeEach(async () => {
  const { clearRemoteJwkSetCache } = await import('../../src/runtime/server/utils/security')
  clearRemoteJwkSetCache()
  errorOutput.length = 0
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    errorOutput.push(String(chunk))
    return true
  })
  vi.stubEnv('NUXT_OIDC_TOKEN_KEY', 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

function createRuntimeConfig(callbackRedirectUrl?: string, baseURL?: string) {
  return {
    ...(baseURL !== undefined && { app: { baseURL } }),
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
          tokenValidationMode: 'legacy',
          validateAccessToken: false,
          validateIdToken: false,
          requiredProperties: [
            'clientId',
            'clientSecret',
            'authorizationUrl',
            'tokenUrl',
            'redirectUri',
          ],
          ...(callbackRedirectUrl !== undefined && { callbackRedirectUrl }),
        },
      },
    },
  }
}

function createStrictRuntimeConfig(overrides: Record<string, unknown> = {}) {
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
          authorizationUrl: `${issuer}/authorize`,
          tokenUrl,
          redirectUri: 'https://app.example.test/auth/oidc/callback',
          audience: 'functional-api',
          tokenValidationMode: 'strict',
          validateAccessToken: true,
          validateIdToken: false,
          openIdConfiguration: { issuer, jwks_uri: jwksUri },
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

function seedCallbackSession(harness: HandlerHarness, includeNonce = true) {
  harness.cookieJar.seedSession('oidc', {
    state: 'functional-state',
    ...(includeNonce && { nonce: 'functional-nonce' }),
    codeVerifier: 'functional-code-verifier',
    redirect: 'https://app.example.test/auth/oidc/callback',
  })
}

async function invokeCallback(harness: HandlerHarness) {
  const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
  const request = harness.createEvent({
    path: '/auth/oidc/callback',
    query: { code: 'functional-code', state: 'functional-state' },
  })
  await callbackHandler(request.event)
  return request
}

describe('callback handler redirects', () => {
  it.each([
    {
      name: 'uses the dynamic auth-session redirect after clearing temporary state',
      sessionCallbackRedirectUrl: '/account/security?reauthenticated=true',
      expectedRedirectUrl: '/account/security?reauthenticated=true',
    },
    {
      name: 'prefers an explicitly configured redirect',
      configuredCallbackRedirectUrl: '/signed-in',
      sessionCallbackRedirectUrl: '/account/security',
      expectedRedirectUrl: '/signed-in',
    },
    {
      name: 'falls back to the application root',
      expectedRedirectUrl: '/',
    },
    {
      name: 'applies a custom application base to the default redirect',
      appBaseURL: '/prefix/',
      expectedRedirectUrl: '/prefix/',
    },
    {
      name: 'applies a custom application base to a session redirect',
      appBaseURL: '/prefix/',
      sessionCallbackRedirectUrl: '/account/security',
      expectedRedirectUrl: '/prefix/account/security',
    },
    {
      name: 'does not double-prefix an already based session redirect',
      appBaseURL: '/prefix/',
      sessionCallbackRedirectUrl: '/prefix/account/security',
      expectedRedirectUrl: '/prefix/account/security',
    },
    {
      name: 'rejects a backslash redirect path',
      sessionCallbackRedirectUrl: '/\\attacker.example/path',
      expectedRedirectUrl: '/',
    },
    {
      name: 'rejects a tab-normalized redirect path',
      sessionCallbackRedirectUrl: '/\t/attacker.example/path',
      expectedRedirectUrl: '/',
    },
  ])(
    '$name',
    async ({
      appBaseURL,
      configuredCallbackRedirectUrl,
      expectedRedirectUrl,
      sessionCallbackRedirectUrl,
    }) => {
      const harness = new HandlerHarness({
        runtimeConfig: createRuntimeConfig(configuredCallbackRedirectUrl, appBaseURL),
      })
      harness.cookieJar.seedSession('oidc', {
        state: 'functional-state',
        nonce: 'functional-nonce',
        codeVerifier: 'functional-code-verifier',
        redirect: 'https://app.example.test/auth/oidc/callback',
        callbackRedirectUrl: sessionCallbackRedirectUrl,
        referer: 'https://app.example.test/start',
      })
      const interceptor = interceptFetch([
        {
          method: 'POST',
          url: tokenUrl,
          respond: () =>
            Response.json({
              access_token: accessToken,
              token_type: 'Bearer',
              expires_in: '300',
            }),
        },
      ])
      const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
      const request = harness.createEvent({
        path: '/auth/oidc/callback',
        query: { code: 'functional-code', state: 'functional-state' },
      })

      await callbackHandler(request.event)

      expect(request.response).toMatchObject({ status: 302, location: expectedRedirectUrl })
      expect(harness.inspectSession('oidc')).toMatchObject({
        clearCount: 1,
        data: {},
        operations: ['clear'],
      })
      expect(request.response.headers['set-cookie']).toStrictEqual(
        expect.arrayContaining(['oidc=; Max-Age=0; Path=/']),
      )
      request.commitResponseCookies()
      expect(harness.cookieJar.get('oidc')).toBeUndefined()
      expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({
        provider: 'oidc',
      })
      expect(interceptor.requests).toHaveLength(1)
    },
  )

  it('does not authenticate a Keycloak public client with a secret', async () => {
    let tokenRequestAuthorization: string | null = null
    let tokenRequestBody: URLSearchParams | undefined
    const harness = new HandlerHarness({
      runtimeConfig: {
        oidc: {
          session: {
            maxAge: 3600,
            automaticRefresh: false,
            expirationCheck: false,
          },
          providers: {
            keycloak: {
              authenticationScheme: 'none',
              baseUrl: 'https://identity.example.test/realms/example',
              clientId: 'functional-client',
              exposeIdToken: false,
              pkce: true,
              redirectUri: 'https://app.example.test/auth/keycloak/callback',
              tokenUrl,
              userInfoUrl: '',
              validateAccessToken: false,
              validateIdToken: false,
            },
          },
        },
      },
    })
    harness.cookieJar.seedSession('oidc', {
      state: 'functional-state',
      nonce: 'functional-nonce',
      codeVerifier: 'functional-code-verifier',
      redirect: 'https://app.example.test/auth/keycloak/callback',
    })
    const interceptor = interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: async (request) => {
          tokenRequestAuthorization = request.headers.get('authorization')
          tokenRequestBody = new URLSearchParams(await request.text())
          return Response.json({
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: '300',
          })
        },
      },
    ])
    const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
    const request = harness.createEvent({
      path: '/auth/keycloak/callback',
      query: { code: 'functional-code', state: 'functional-state' },
    })

    await callbackHandler(request.event)

    expect(request.response).toMatchObject({ status: 302, location: '/' })
    expect(interceptor.requests).toHaveLength(1)
    expect(tokenRequestAuthorization).toBeNull()
    expect(tokenRequestBody?.get('client_id')).toBe('functional-client')
    expect(tokenRequestBody?.get('code_verifier')).toBe('functional-code-verifier')
    expect(tokenRequestBody?.has('client_secret')).toBe(false)
  })
})

const keycloakRedirectUri = 'https://app.example.test/auth/keycloak/callback'
const authorizationCodePattern = /name="code" value="([^"]+)"/u

async function startLogin(harness: HandlerHarness): Promise<URL> {
  const loginHandler = (await import('../../src/runtime/server/handler/login.get')).default
  const request = harness.createEvent({ path: '/auth/keycloak/login' })
  await loginHandler(request.event)
  request.commitResponseCookies()
  expect(request.response.status).toBe(302)
  return new URL(request.response.location ?? '')
}

async function authorize(authorizationUrl: URL): Promise<string> {
  const response = await fetch(authorizationUrl)
  expect(response.status).toBe(200)
  const code = authorizationCodePattern.exec(await response.text())?.[1]
  if (code === undefined) {
    throw new Error('The provider did not issue an authorization code')
  }
  return code
}

async function invokeKeycloakCallback(
  harness: HandlerHarness,
  body: { code: string; state: string },
) {
  const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
  const request = harness.createEvent({ method: 'POST', path: '/auth/keycloak/callback', body })
  await callbackHandler(request.event)
  request.commitResponseCookies()
  return request.response
}

describe('Keycloak callback transaction binding', () => {
  let provider: Awaited<ReturnType<typeof startFaultOidcProvider>>

  beforeAll(async () => {
    provider = await startFaultOidcProvider(keycloakRedirectUri, 'https://app.example.test/')
  })

  beforeEach(() => {
    provider.reset()
  })

  afterAll(async () => {
    await provider.close()
  })

  function createKeycloakHarness(overrides: Record<string, unknown> = {}) {
    return new HandlerHarness({
      runtimeConfig: {
        oidc: {
          session: {
            maxAge: 3600,
            automaticRefresh: false,
            expirationCheck: false,
          },
          providers: {
            keycloak: {
              audience: 'browser-api',
              authorizationUrl: `${provider.origin}/authorize`,
              baseUrl: provider.origin,
              clientId: 'browser-client',
              clientSecret: 'browser-secret',
              openIdConfiguration: `${provider.origin}/.well-known/openid-configuration`,
              redirectUri: keycloakRedirectUri,
              tokenUrl: `${provider.origin}/token`,
              userInfoUrl: `${provider.origin}/userinfo`,
              ...overrides,
            },
          },
        },
      },
    })
  }

  // An attacker requests a code for their own account without a PKCE challenge
  async function authorizeAttacker(): Promise<string> {
    const authorizationUrl = new URL('/authorize', provider.origin)
    authorizationUrl.searchParams.set('redirect_uri', keycloakRedirectUri)
    authorizationUrl.searchParams.set('state', 'attacker-state')
    authorizationUrl.searchParams.set('nonce', 'attacker-nonce')
    return await authorize(authorizationUrl)
  }

  it('sends state with the PKCE challenge in authorization requests', async () => {
    const harness = createKeycloakHarness()

    const authorizationUrl = await startLogin(harness)

    const authSession = harness.inspectSession('oidc')?.data
    expect(authorizationUrl.searchParams.get('state')).toBe(authSession?.['state'])
    expect(authorizationUrl.searchParams.get('state')).toStrictEqual(expect.any(String))
    expect(authorizationUrl.searchParams.get('code_challenge')).toStrictEqual(expect.any(String))
    expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('redeems a code bound to the matching state and PKCE verifier', async () => {
    const harness = createKeycloakHarness()
    const authorizationUrl = await startLogin(harness)
    const code = await authorize(authorizationUrl)

    const response = await invokeKeycloakCallback(harness, {
      code,
      state: authorizationUrl.searchParams.get('state') ?? '',
    })

    expect(response).toMatchObject({ status: 302, location: '/' })
    expect(provider.getTokenRequestCount()).toBe(1)
    expect(harness.cookieJar.get('oidc')).toBeUndefined()
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({
      provider: 'keycloak',
      userInfo: { displayName: 'First User' },
    })
  })

  it.each([
    { name: 'the Keycloak preset', overrides: {} },
    { name: 'state disabled', overrides: { state: false } },
  ])(
    'rejects a callback without an auth transaction before token exchange with $name',
    async ({ overrides }) => {
      const code = await authorizeAttacker()
      const harness = createKeycloakHarness(overrides)

      const response = await invokeKeycloakCallback(harness, { code, state: 'attacker-state' })

      expect(response).toMatchObject({ status: 302, location: '/' })
      expect(provider.getTokenRequestCount()).toBe(0)
      expect(harness.inspectSession('nuxt-oidc-auth')?.data ?? {}).toStrictEqual({})
    },
  )

  it('rejects a callback without a PKCE verifier before token exchange', async () => {
    const code = await authorizeAttacker()
    const harness = createKeycloakHarness()
    harness.cookieJar.seedSession('oidc', { state: 'attacker-state' })

    const response = await invokeKeycloakCallback(harness, { code, state: 'attacker-state' })

    expect(response).toMatchObject({ status: 302, location: '/' })
    expect(provider.getTokenRequestCount()).toBe(0)
    expect(harness.inspectSession('nuxt-oidc-auth')?.data ?? {}).toStrictEqual({})
  })

  it('rejects a callback whose state does not match before token exchange', async () => {
    const harness = createKeycloakHarness()
    await startLogin(harness)
    const code = await authorizeAttacker()

    const response = await invokeKeycloakCallback(harness, { code, state: 'attacker-state' })

    expect(response).toMatchObject({ status: 302, location: '/' })
    expect(provider.getTokenRequestCount()).toBe(0)
    expect(harness.inspectSession('nuxt-oidc-auth')?.data ?? {}).toStrictEqual({})
  })
})

describe('callback token validation', () => {
  it.each([
    {
      name: 'wrong signature',
      claims: { aud: 'functional-api', iss: issuer, sub: 'user-1' },
      untrusted: true,
    },
    {
      name: 'expired token',
      claims: { aud: 'functional-api', exp: 0, iss: issuer, sub: 'user-1' },
    },
    {
      name: 'wrong issuer',
      claims: {
        aud: 'functional-api',
        iss: 'https://attacker.example.test',
        sub: 'user-1',
      },
    },
    { name: 'missing audience', claims: { iss: issuer, sub: 'user-1' } },
  ])('rejects strict access tokens with $name', async ({ claims, untrusted }) => {
    const token = await (untrusted === true ? untrustedSigningFixture : signingFixture).sign(claims)
    const harness = new HandlerHarness({ runtimeConfig: createStrictRuntimeConfig() })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: token, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual({})
  })

  it.each([
    { name: 'string', audience: 'functional-api' },
    { name: 'array', audience: ['another-audience', 'functional-api'] },
  ])('accepts strict access tokens with matching $name audience', async ({ audience }) => {
    const token = await signingFixture.sign({ aud: audience, iss: issuer, sub: 'user-1' })
    const harness = new HandlerHarness({ runtimeConfig: createStrictRuntimeConfig() })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: token, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({ provider: 'oidc' })
  })

  it('validates strict access tokens even when their decoded audience does not match', async () => {
    const wrongAudienceToken = await signingFixture.sign({
      aud: 'functional-client',
      iss: issuer,
      sub: 'user-1',
    })
    const harness = new HandlerHarness({ runtimeConfig: createStrictRuntimeConfig() })
    seedCallbackSession(harness)
    const interceptor = interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: wrongAudienceToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(interceptor.requests.map((request) => request.url)).toContain(jwksUri)
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual({})
  })

  it('validates enabled ID tokens independently from disabled access-token validation', async () => {
    const idToken = await signingFixture.sign({
      aud: 'functional-client',
      iss: issuer,
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        validateAccessToken: false,
        validateIdToken: true,
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({ access_token: accessToken, id_token: idToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({ provider: 'oidc' })
  })

  it.each([
    { name: 'accepts a trusted ID token', trusted: true },
    { name: 'rejects an untrusted ID token', trusted: false },
  ])('$name with an Auth0 opaque access token', async ({ trusted }) => {
    const auth0TokenUrl = `${issuer}/oauth/token`
    const discoveryUrl = `${issuer}/.well-known/openid-configuration`
    const opaqueAccessToken = 'opaque-auth0-access-token'
    const idToken = await (trusted ? signingFixture : untrustedSigningFixture).sign({
      aud: 'functional-client',
      iss: issuer,
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: {
        oidc: {
          session: {
            maxAge: 3600,
            automaticRefresh: false,
            expirationCheck: false,
          },
          providers: {
            auth0: {
              baseUrl: issuer,
              clientId: 'functional-client',
              clientSecret: 'functional-secret',
              redirectUri: 'https://app.example.test/auth/auth0/callback',
              tokenValidationMode: 'strict',
              skipAccessTokenParsing: true,
              validateAccessToken: false,
              validateIdToken: true,
            },
          },
        },
      },
    })
    harness.cookieJar.seedSession('oidc', {
      state: 'functional-state',
      codeVerifier: 'functional-code-verifier',
      redirect: 'https://app.example.test/auth/auth0/callback',
    })
    const interceptor = interceptFetch([
      {
        method: 'POST',
        url: auth0TokenUrl,
        respond: () =>
          Response.json({
            access_token: opaqueAccessToken,
            id_token: idToken,
            token_type: 'Bearer',
          }),
      },
      {
        url: discoveryUrl,
        respond: () => Response.json({ issuer, jwks_uri: jwksUri }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
      {
        url: `${issuer}/userinfo`,
        respond: () => Response.json({ sub: 'user-1' }),
      },
    ])
    const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
    const request = harness.createEvent({
      path: '/auth/auth0/callback',
      query: { code: 'functional-code', state: 'functional-state' },
    })

    await callbackHandler(request.event)

    const expectedSession: unknown = expect.objectContaining({
      provider: 'auth0',
      userInfo: { sub: 'user-1' },
    })
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual(
      trusted ? expectedSession : {},
    )
    const userInfoRequest = interceptor.requests.find(
      (fetchRequest) => fetchRequest.url === `${issuer}/userinfo`,
    )
    expect(userInfoRequest?.headers.get('authorization')).toBe(
      trusted ? `Bearer ${opaqueAccessToken}` : undefined,
    )
  })

  it.each([
    { name: 'missing', azp: undefined, accepted: false },
    { name: 'different', azp: 'another-client', accepted: false },
    { name: 'matching', azp: 'functional-client', accepted: true },
  ])('$name azp for strict multi-audience ID tokens', async ({ accepted, azp }) => {
    const idToken = await signingFixture.sign({
      aud: ['functional-client', 'another-audience'],
      ...(azp !== undefined && { azp }),
      iss: issuer,
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        validateAccessToken: false,
        validateIdToken: true,
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({ access_token: accessToken, id_token: idToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    const expectedSession: unknown = expect.objectContaining({ provider: 'oidc' })
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual(
      accepted ? expectedSession : {},
    )
  })

  it.each([
    { name: 'matching', azp: 'functional-client', accepted: true },
    { name: 'different', azp: 'another-client', accepted: false },
  ])('$name azp for strict single-audience ID tokens', async ({ accepted, azp }) => {
    const idToken = await signingFixture.sign({
      aud: 'functional-client',
      azp,
      iss: issuer,
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        validateAccessToken: false,
        validateIdToken: true,
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({ access_token: accessToken, id_token: idToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    const expectedSession: unknown = expect.objectContaining({ provider: 'oidc' })
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual(
      accepted ? expectedSession : {},
    )
  })

  it.each([
    { name: 'missing', nonce: undefined, accepted: false },
    { name: 'different', nonce: 'wrong-nonce', accepted: false },
    { name: 'matching', nonce: 'functional-nonce', accepted: true },
  ])('$name nonce for strict ID tokens', async ({ accepted, nonce }) => {
    const idToken = await signingFixture.sign({
      aud: 'functional-client',
      iss: issuer,
      ...(nonce !== undefined && { nonce }),
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        nonce: true,
        validateAccessToken: false,
        validateIdToken: true,
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({ access_token: accessToken, id_token: idToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    const expectedSession: unknown = expect.objectContaining({ provider: 'oidc' })
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual(
      accepted ? expectedSession : {},
    )
  })

  it.each([
    { name: 'different', nonce: 'wrong-nonce', accepted: false },
    { name: 'matching', nonce: 'functional-nonce', accepted: true },
  ])('$name generated nonce for strict hybrid ID tokens', async ({ accepted, nonce }) => {
    const idToken = await signingFixture.sign({
      aud: 'functional-client',
      iss: issuer,
      nonce,
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        nonce: false,
        responseType: 'code id_token',
        validateAccessToken: false,
        validateIdToken: true,
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({ access_token: accessToken, id_token: idToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    const expectedSession: unknown = expect.objectContaining({ provider: 'oidc' })
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual(
      accepted ? expectedSession : {},
    )
  })

  it('rejects strict ID tokens when enabled nonce is missing from the auth session', async () => {
    const idToken = await signingFixture.sign({
      aud: 'functional-client',
      iss: issuer,
      nonce: 'functional-nonce',
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        nonce: true,
        validateAccessToken: false,
        validateIdToken: true,
      }),
    })
    seedCallbackSession(harness, false)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({ access_token: accessToken, id_token: idToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual({})
  })

  it.each(['sub', 'iat'] as const)('requires %s in strict ID tokens', async (missingClaim) => {
    const claims = {
      aud: 'functional-client',
      exp: Math.trunc(Date.now() / 1000) + 300,
      iss: issuer,
      sub: 'user-1',
      iat: Math.trunc(Date.now() / 1000),
    }
    const tokenClaims = Object.fromEntries(
      Object.entries(claims).filter(([name]) => name !== missingClaim),
    )
    const idToken = await new SignJWT(tokenClaims)
      .setProtectedHeader({ alg: 'RS256', kid: signingFixture.privateJwk.kid })
      .sign(await importJWK(signingFixture.privateJwk, 'RS256'))
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        validateAccessToken: false,
        validateIdToken: true,
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({ access_token: accessToken, id_token: idToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual({})
  })

  it('requires sub to be a string in strict ID tokens', async () => {
    const claims: Record<string, unknown> = {
      aud: 'functional-client',
      exp: Math.trunc(Date.now() / 1000) + 300,
      iat: Math.trunc(Date.now() / 1000),
      iss: issuer,
      sub: 42,
    }
    const idToken = await new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: signingFixture.privateJwk.kid })
      .sign(await importJWK(signingFixture.privateJwk, 'RS256'))
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        validateAccessToken: false,
        validateIdToken: true,
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({ access_token: accessToken, id_token: idToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual({})
  })

  it('preserves legacy multi-audience ID tokens without azp', async () => {
    const idToken = await signingFixture.sign({
      aud: ['functional-client', 'another-audience'],
      iss: issuer,
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        tokenValidationMode: 'legacy',
        validateAccessToken: false,
        validateIdToken: true,
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({ access_token: accessToken, id_token: idToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({ provider: 'oidc' })
  })

  it('fails strict validation when enabled ID token is missing', async () => {
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        validateAccessToken: false,
        validateIdToken: true,
      }),
    })
    seedCallbackSession(harness)
    const interceptor = interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: accessToken, token_type: 'Bearer' }),
      },
    ])

    await invokeCallback(harness)

    expect(interceptor.requests).toHaveLength(1)
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual({})
  })

  it('requires exp in strict mode', async () => {
    const privateKey = await importJWK(signingFixture.privateJwk, 'RS256')
    const tokenWithoutExpiration = await new SignJWT({
      aud: 'functional-api',
      iss: issuer,
      sub: 'user-1',
    })
      .setProtectedHeader({ alg: 'RS256', kid: signingFixture.privateJwk.kid })
      .setIssuedAt()
      .sign(privateKey)
    const harness = new HandlerHarness({ runtimeConfig: createStrictRuntimeConfig() })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({ access_token: tokenWithoutExpiration, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual({})
  })

  it.each([
    { name: 'issuer', openIdConfiguration: { jwks_uri: jwksUri } },
    {
      name: 'non-empty issuer array',
      openIdConfiguration: { issuer: [issuer, ' '], jwks_uri: jwksUri },
    },
    { name: 'jwks_uri', openIdConfiguration: { issuer } },
  ])('requires discovery $name in strict mode', async ({ openIdConfiguration }) => {
    const strictAccessToken = await signingFixture.sign({
      aud: 'functional-api',
      iss: issuer,
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({ openIdConfiguration }),
    })
    seedCallbackSession(harness)
    const interceptor = interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: strictAccessToken, token_type: 'Bearer' }),
      },
    ])

    await invokeCallback(harness)

    expect(interceptor.requests).toHaveLength(1)
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual({})
  })

  it('accepts strict discovery issuer arrays', async () => {
    const strictAccessToken = await signingFixture.sign({
      aud: 'functional-api',
      iss: issuer,
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        openIdConfiguration: { issuer: [issuer, `${issuer}/tenant`], jwks_uri: jwksUri },
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: strictAccessToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({ provider: 'oidc' })
  })

  it('preserves legacy issuer arrays when validating tokens', async () => {
    const wrongIssuerToken = await signingFixture.sign({
      aud: 'functional-client',
      iss: 'https://attacker.example.test',
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        openIdConfiguration: { issuer: [issuer, `${issuer}/tenant`], jwks_uri: jwksUri },
        tokenValidationMode: 'legacy',
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: wrongIssuerToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual({})
  })

  it('preserves malformed legacy issuer arrays for fail-closed validation', async () => {
    const wrongIssuerToken = await signingFixture.sign({
      aud: 'functional-client',
      iss: 'https://attacker.example.test',
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        openIdConfiguration: { issuer: [issuer, ' '], jwks_uri: jwksUri },
        tokenValidationMode: 'legacy',
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: wrongIssuerToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual({})
  })

  it('rejects mixed-type legacy issuer arrays instead of dropping issuer validation', async () => {
    const matchingToken = await signingFixture.sign({
      aud: 'functional-client',
      iss: issuer,
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        openIdConfiguration: {
          issuer: [issuer, undefined],
          jwks_uri: jwksUri,
        },
        tokenValidationMode: 'legacy',
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: matchingToken, token_type: 'Bearer' }),
      },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual({})
  })

  it('does not inspect malformed decoded audiences before strict validation', async () => {
    const privateKey = await importJWK(signingFixture.privateJwk, 'RS256')
    const claims: Record<string, unknown> = { aud: 42, iss: issuer, sub: 'user-1' }
    const malformedAudienceToken = await new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: signingFixture.privateJwk.kid })
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey)
    const harness = new HandlerHarness({ runtimeConfig: createStrictRuntimeConfig() })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({ access_token: malformedAudienceToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await expect(invokeCallback(harness)).resolves.toBeDefined()

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual({})
  })

  it('preserves legacy validation without exp and matches array audiences by exact member', async () => {
    const privateKey = await importJWK(signingFixture.privateJwk, 'RS256')
    const legacyToken = await new SignJWT({
      aud: ['another-audience', 'functional-client'],
      iss: issuer,
      sub: 'user-1',
    })
      .setProtectedHeader({ alg: 'RS256', kid: signingFixture.privateJwk.kid })
      .setIssuedAt()
      .sign(privateKey)
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        tokenValidationMode: 'legacy',
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json({ access_token: legacyToken, token_type: 'Bearer' }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({ provider: 'oidc' })
  })

  it('preserves shared legacy audience gating for every enabled token type', async () => {
    const matchingAccessToken = await signingFixture.sign({
      aud: 'functional-client',
      iss: issuer,
      sub: 'user-1',
    })
    const invalidIdToken = await signingFixture.sign({
      aud: 'unmatched-audience',
      iss: 'https://attacker.example.test',
      sub: 'user-1',
    })
    const harness = new HandlerHarness({
      runtimeConfig: createStrictRuntimeConfig({
        audience: undefined,
        tokenValidationMode: 'legacy',
        validateAccessToken: true,
        validateIdToken: true,
      }),
    })
    seedCallbackSession(harness)
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({
            access_token: matchingAccessToken,
            id_token: invalidIdToken,
            token_type: 'Bearer',
          }),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])

    await invokeCallback(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual({})
  })

  it('uses exact legacy string audience matching and warns once per provider', async () => {
    const similarAudienceToken = await signingFixture.sign({
      aud: 'prefix-functional-client-suffix',
      sub: 'user-1',
    })
    const runtimeConfig = createRuntimeConfig()
    runtimeConfig.oidc.providers.oidc.validateAccessToken = true

    for (let requestNumber = 0; requestNumber < 2; requestNumber += 1) {
      const harness = new HandlerHarness({ runtimeConfig })
      seedCallbackSession(harness)
      interceptFetch([
        {
          method: 'POST',
          url: tokenUrl,
          respond: () =>
            Response.json({ access_token: similarAudienceToken, token_type: 'Bearer' }),
        },
      ])
      // oxlint-disable-next-line eslint/no-await-in-loop -- The second callback verifies the warning stays suppressed after the first request.
      await invokeCallback(harness)
      expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({ provider: 'oidc' })
    }

    const warnings = errorOutput.filter((message) =>
      message.includes("tokenValidationMode: 'strict'"),
    )
    expect(warnings).toHaveLength(1)
    expect(warnings.join(' ')).not.toContain(similarAudienceToken)
  })
})
