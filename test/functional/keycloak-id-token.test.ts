import { isError } from 'h3'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { TokenFault } from '../setup/fault-oidc-provider'
import { startFaultOidcProvider } from '../setup/fault-oidc-provider'
import { HandlerHarness } from './handler-harness'
import { refresh, tokenKey } from './refresh-harness'

const redirectUri = 'https://app.example.test/auth/keycloak/callback'
const authorizationCodePattern = /name="code" value="([^"]+)"/u

let provider: Awaited<ReturnType<typeof startFaultOidcProvider>>
const errorOutput: string[] = []

beforeAll(async () => {
  provider = await startFaultOidcProvider(redirectUri, 'https://app.example.test/')
})

beforeEach(() => {
  provider.reset()
  vi.stubEnv('NUXT_OIDC_TOKEN_KEY', tokenKey)
  errorOutput.length = 0
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    errorOutput.push(String(chunk))
    return true
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

afterAll(async () => {
  await provider.close()
})

// Leaves validateIdToken unset, so the Keycloak preset default applies
function createHarness(overrides: Record<string, unknown> = {}) {
  return new HandlerHarness({
    runtimeConfig: {
      oidc: {
        session: { maxAge: 3600, automaticRefresh: false, expirationCheck: false },
        providers: {
          keycloak: {
            audience: 'browser-api',
            baseUrl: provider.origin,
            clientId: 'browser-client',
            clientSecret: 'browser-secret',
            authorizationUrl: `${provider.origin}/authorize`,
            tokenUrl: `${provider.origin}/token`,
            userInfoUrl: `${provider.origin}/userinfo`,
            openIdConfiguration: `${provider.origin}/.well-known/openid-configuration`,
            redirectUri,
            ...overrides,
          },
        },
      },
    },
  })
}

async function signIn(harness: HandlerHarness) {
  const loginHandler = (await import('../../src/runtime/server/handler/login.get')).default
  const login = harness.createEvent({ path: '/auth/keycloak/login' })
  await loginHandler(login.event)
  login.commitResponseCookies()
  const authorizationUrl = new URL(login.response.location ?? '')
  const authorizationPage = await (await fetch(authorizationUrl)).text()
  const code = authorizationCodePattern.exec(authorizationPage)?.[1] ?? ''

  const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
  const callback = harness.createEvent({
    method: 'POST',
    path: '/auth/keycloak/callback',
    body: { code, state: authorizationUrl.searchParams.get('state') ?? '' },
  })
  await callbackHandler(callback.event)
  callback.commitResponseCookies()
  return callback.response
}

function persistentSessions(harness: HandlerHarness) {
  return [...harness.inspectStorage('oidc').values()]
}

describe('Keycloak preset ID token validation', () => {
  it('creates a session for a valid ID token', async () => {
    const harness = createHarness()

    const response = await signIn(harness)

    expect(response).toMatchObject({ status: 302, location: '/' })
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({
      provider: 'keycloak',
      canRefresh: true,
    })
    expect(persistentSessions(harness)).toHaveLength(1)
  })

  it.each<{ fault: TokenFault; reason: string }>([
    { fault: 'audience-mismatch', reason: 'unexpected "aud" claim value' },
    { fault: 'issuer-mismatch', reason: 'unexpected "iss" claim value' },
    { fault: 'invalid-signature', reason: 'signature verification failed' },
    { fault: 'nonce-mismatch', reason: 'ID token nonce must match the authentication request' },
  ])('rejects an ID token with $fault before a session is created', async ({ fault, reason }) => {
    provider.setTokenFault(fault, 'id-token')
    const harness = createHarness()

    const response = await signIn(harness)

    expect(response).toMatchObject({ status: 302, location: '/' })
    expect(provider.getTokenRequestCount()).toBe(1)
    expect(harness.inspectSession('nuxt-oidc-auth')?.data ?? {}).toStrictEqual({})
    expect(persistentSessions(harness)).toStrictEqual([])
    expect(errorOutput.join('')).toContain('[keycloak] Token validation failed')
    expect(errorOutput.join('')).toContain(reason)
  })

  it('keeps validateIdToken: false as an explicit opt-out', async () => {
    provider.setTokenFault('invalid-signature', 'id-token')
    const harness = createHarness({ validateIdToken: false })

    await signIn(harness)

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({ provider: 'keycloak' })
  })

  it('refreshes a session with a validated ID token', async () => {
    const harness = createHarness()
    await signIn(harness)

    const { result } = await refresh(harness)

    expect(result).toMatchObject({ provider: 'keycloak', canRefresh: true })
    expect(provider.getTokenRequestCount()).toBe(2)
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({ provider: 'keycloak' })
    expect(persistentSessions(harness)).toHaveLength(1)
  })

  it('ends the session when a refreshed ID token is invalid', async () => {
    const harness = createHarness()
    await signIn(harness)
    provider.setTokenFault('invalid-signature', 'id-token')

    const { result } = await refresh(harness)

    expect(isError(result) && result.statusCode).toBe(401)
    expect(harness.inspectSession('nuxt-oidc-auth')?.data ?? {}).toStrictEqual({})
    expect(persistentSessions(harness)).toStrictEqual([])
  })
})
