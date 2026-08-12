import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createRs256Fixture, HandlerHarness, interceptFetch } from './handler-harness'

const tokenUrl = 'https://identity.example.test/token'
let accessToken: string

beforeAll(async () => {
  const fixture = await createRs256Fixture()
  accessToken = await fixture.sign({ aud: 'functional-client', sub: 'user-1' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

function createRuntimeConfig(callbackRedirectUrl?: string) {
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
          validateAccessToken: false,
          validateIdToken: false,
          requiredProperties: [
            'clientId',
            'clientSecret',
            'authorizationUrl',
            'tokenUrl',
            'redirectUri',
          ],
          ...(callbackRedirectUrl && { callbackRedirectUrl }),
        },
      },
    },
  }
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
    async ({ configuredCallbackRedirectUrl, expectedRedirectUrl, sessionCallbackRedirectUrl }) => {
      const harness = new HandlerHarness({
        runtimeConfig: createRuntimeConfig(configuredCallbackRedirectUrl),
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
      expect(request.response.headers['set-cookie']).toEqual(
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
      query: { code: 'functional-code' },
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
