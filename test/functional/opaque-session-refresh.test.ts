import type { PersistentSession } from '../../src/runtime/types'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRs256Fixture, HandlerHarness, interceptFetch } from './handler-harness'

const clientId = 'functional-client'
const issuer = 'https://identity.example.test'
const jwksUri = `${issuer}/jwks`
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
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('opaque access-token sessions', () => {
  it('uses token response expiry to trigger automatic refresh', async () => {
    const initialIdToken = await signingFixture.sign({
      aud: clientId,
      iss: issuer,
      role: 'initial-role',
      sub: 'user-1',
    })
    const refreshedIdToken = await signingFixture.sign({
      aud: clientId,
      iss: issuer,
      role: 'refreshed-role',
      sub: 'user-1',
    })
    const tokenResponses = [
      {
        access_token: 'initial-opaque-access-token',
        expires_in: '60',
        id_token: initialIdToken,
        refresh_token: 'initial-refresh-token',
        token_type: 'Bearer',
      },
      {
        access_token: 'refreshed-opaque-access-token',
        expires_in: '3600',
        id_token: refreshedIdToken,
        refresh_token: 'rotated-refresh-token',
        token_type: 'Bearer',
      },
    ]
    let tokenResponseIndex = 0
    const harness = new HandlerHarness({
      runtimeConfig: {
        oidc: {
          session: {
            automaticRefresh: true,
            expirationCheck: true,
            expirationThreshold: 120,
            maxAge: 3600,
          },
          providers: {
            oidc: {
              authorizationUrl: `${issuer}/authorize`,
              clientId,
              clientSecret: 'functional-secret',
              exposeAccessToken: false,
              exposeIdToken: false,
              openIdConfiguration: { issuer, jwks_uri: jwksUri },
              optionalClaims: ['role'],
              redirectUri: 'https://app.example.test/auth/oidc/callback',
              requiredProperties: [
                'clientId',
                'clientSecret',
                'authorizationUrl',
                'tokenUrl',
                'redirectUri',
              ],
              sessionConfiguration: {
                automaticRefresh: true,
                expirationCheck: true,
                expirationThreshold: 120,
              },
              skipAccessTokenParsing: true,
              tokenUrl,
              tokenValidationMode: 'strict',
              validateAccessToken: false,
              validateIdToken: true,
            },
          },
        },
      },
    })
    harness.cookieJar.seedSession('oidc', {
      codeVerifier: 'functional-code-verifier',
      redirect: 'https://app.example.test/auth/oidc/callback',
      state: 'functional-state',
    })
    const interceptor = interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () => Response.json(tokenResponses[tokenResponseIndex++]!),
      },
      { url: jwksUri, respond: () => Response.json(signingFixture.jwks) },
    ])
    const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
    const callbackRequest = harness.createEvent({
      path: '/auth/oidc/callback',
      query: { code: 'functional-code', state: 'functional-state' },
    })
    const beforeCallback = Math.trunc(Date.now() / 1000)

    await callbackHandler(callbackRequest.event)
    callbackRequest.commitResponseCookies()

    const initialSession = harness.inspectSession('nuxt-oidc-auth')
    if (!initialSession) throw new Error('Callback did not create a user session')
    const persistentSession = harness.inspectStorage('oidc').get(initialSession.id) as
      | PersistentSession
      | undefined
    if (!persistentSession) throw new Error('Callback did not create a persistent session')
    expect(initialSession.data).toEqual(
      expect.objectContaining({
        canRefresh: true,
        claims: { role: 'initial-role' },
        provider: 'oidc',
      }),
    )
    expect(initialSession.data).not.toHaveProperty('accessToken')
    expect(initialSession.data).not.toHaveProperty('idToken')
    expect(persistentSession.exp).toBeGreaterThanOrEqual(beforeCallback + 60)
    expect(persistentSession.exp).toBeLessThanOrEqual(Math.trunc(Date.now() / 1000) + 60)
    expect(persistentSession.iat).toBeGreaterThanOrEqual(beforeCallback)
    expect(initialSession.data.expireAt).toBeGreaterThan(persistentSession.exp)

    const { getUserSession } = await import('../../src/runtime/server/utils/session')
    const sessionRequest = harness.createEvent({ path: '/api/_auth/session' })
    const refreshedSession = await getUserSession(sessionRequest.event, {
      errorBehavior: 'throw',
    })

    expect(refreshedSession).toEqual(
      expect.objectContaining({
        canRefresh: true,
        claims: { role: 'refreshed-role' },
        provider: 'oidc',
      }),
    )
    expect(refreshedSession).not.toHaveProperty('accessToken')
    expect(refreshedSession).not.toHaveProperty('idToken')
    expect(interceptor.requests.filter((request) => request.url === tokenUrl)).toHaveLength(2)
  })
})
