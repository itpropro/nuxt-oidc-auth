import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRs256Fixture, HandlerHarness, interceptFetch } from './handler-harness'

const runtimeConfig = {
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
        tokenUrl: 'https://identity.example.test/token',
        redirectUri: 'https://app.example.test/auth/oidc/callback',
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

afterEach(() => {
  vi.restoreAllMocks()
})

describe('functional handler harness', () => {
  it('invokes login with inspectable auth state and a cookie jar shared across requests', async () => {
    const harness = new HandlerHarness({
      runtimeConfig,
      cookies: { consent: 'accepted' },
    })
    const loginHandler = (await import('../../src/runtime/server/handler/login.get')).default

    const firstRequest = harness.createEvent({
      path: '/auth/oidc/login',
      query: { callbackRedirectUrl: '/account' },
      headers: { referer: 'https://app.example.test/start' },
    })
    await loginHandler(firstRequest.event)
    firstRequest.commitResponseCookies()

    expect(firstRequest.response.status).toBe(302)
    expect(firstRequest.response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringMatching(/^oidc=functional-session-\d+; Path=\/$/)]),
    )
    const authorizationUrl = new URL(firstRequest.response.location!)
    expect(authorizationUrl.origin + authorizationUrl.pathname).toBe(
      'https://identity.example.test/authorize',
    )
    expect(authorizationUrl.searchParams.get('client_id')).toBe('functional-client')

    const firstAuthSession = harness.inspectSession('oidc')
    expect(firstAuthSession?.clearCount).toBe(1)
    expect(firstAuthSession?.operations).toContain('update')
    expect(firstAuthSession?.data).toMatchObject({
      callbackRedirectUrl: '/account',
      referer: 'https://app.example.test/start',
    })
    expect(firstAuthSession?.data.state).toEqual(expect.any(String))
    expect(firstAuthSession?.data.codeVerifier).toEqual(expect.any(String))

    const secondRequest = harness.createEvent({ path: '/auth/oidc/login' })
    await loginHandler(secondRequest.event)

    expect(secondRequest.response.status).toBe(302)
    expect(harness.cookieJar.get('consent')).toBe('accepted')
    expect(harness.inspectSession('oidc')?.id).toBe(firstAuthSession?.id)
    expect(harness.inspectSession('oidc')?.clearCount).toBe(2)
  })

  it('invokes callback POST with configurable body and cookies', async () => {
    const harness = new HandlerHarness({ runtimeConfig })
    const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
    const request = harness.createEvent({
      method: 'POST',
      path: '/auth/oidc/callback',
      body: { admin_consent: 'accepted' },
      cookies: { transaction: 'callback' },
    })

    await callbackHandler(request.event)

    expect(request.response).toMatchObject({
      status: 200,
      location: 'https://app.example.test/auth/oidc/login',
    })
    const { getCookie } = await import('h3')
    expect(getCookie(request.event, 'transaction')).toBe('callback')
    expect(harness.cookieJar.get('transaction')).toBeUndefined()
    expect(harness.inspectSession('oidc')).toMatchObject({
      clearCount: 0,
      data: {},
      operations: [],
    })
  })

  it('invokes logout and exposes cleared user-session state', async () => {
    const harness = new HandlerHarness({ runtimeConfig })
    harness.cookieJar.seedSession('nuxt-oidc-auth', {
      provider: 'oidc',
      canRefresh: false,
      expireAt: Math.trunc(Date.now() / 1000) + 300,
    })
    const logoutHandler = (await import('../../src/runtime/server/handler/logout.get')).default
    const request = harness.createEvent({ path: '/auth/oidc/logout' })

    await logoutHandler(request.event)

    expect(request.response).toMatchObject({
      status: 302,
      location: 'https://app.example.test',
    })
    expect(harness.inspectSession('nuxt-oidc-auth')).toMatchObject({
      clearCount: 1,
      data: {},
      operations: ['clear'],
    })
    expect(request.response.headers['set-cookie']).toEqual(
      expect.arrayContaining(['nuxt-oidc-auth=; Max-Age=0; Path=/']),
    )
    request.commitResponseCookies()
    expect(harness.cookieJar.get('nuxt-oidc-auth')).toBeUndefined()
  })

  it('clears dev-mode sessions and redirects locally without provider resolution', async () => {
    const harness = new HandlerHarness({ runtimeConfig })
    harness.cookieJar.seedSession('nuxt-oidc-auth', {
      provider: 'dev',
      canRefresh: false,
      expireAt: Math.trunc(Date.now() / 1000) + 300,
    })
    const logoutHandler = (await import('../../src/runtime/server/handler/logout.get')).default
    const request = harness.createEvent({ path: '/auth/dev/logout' })

    await logoutHandler(request.event)

    expect(request.response).toMatchObject({
      status: 302,
      location: 'https://app.example.test',
    })
    expect(harness.inspectSession('nuxt-oidc-auth')).toMatchObject({
      clearCount: 1,
      data: {},
    })
  })

  it('isolates pre-created request cookies until response cookies are committed', async () => {
    const harness = new HandlerHarness({
      runtimeConfig,
      cookies: { obsolete: 'remove-me', preference: 'original' },
    })
    const firstRequest = harness.createEvent({ path: '/first' })
    const concurrentRequest = harness.createEvent({ path: '/concurrent' })
    const { deleteCookie, getCookie, setCookie, useSession } = await import('h3')

    setCookie(firstRequest.event, 'preference', 'updated')
    deleteCookie(firstRequest.event, 'obsolete')
    const firstSession = await useSession(firstRequest.event, {
      name: 'oidc',
      password: 'functional-test-password',
    })
    await firstSession.update({ state: 'first' })

    expect(firstRequest.response.headers['set-cookie']).toEqual([
      'preference=updated; Path=/',
      'obsolete=; Max-Age=0; Path=/',
      `oidc=${firstSession.id}; Path=/`,
    ])

    firstRequest.commitResponseCookies()

    expect(getCookie(concurrentRequest.event, 'preference')).toBe('original')
    expect(getCookie(concurrentRequest.event, 'obsolete')).toBe('remove-me')
    const concurrentSession = await useSession(concurrentRequest.event, {
      name: 'oidc',
      password: 'functional-test-password',
    })
    expect(concurrentSession.id).not.toBe(firstSession.id)

    const laterRequest = harness.createEvent({ path: '/later' })
    expect(getCookie(laterRequest.event, 'preference')).toBe('updated')
    expect(getCookie(laterRequest.event, 'obsolete')).toBeUndefined()
    expect(
      (
        await useSession(laterRequest.event, {
          name: 'oidc',
          password: 'functional-test-password',
        })
      ).id,
    ).toBe(firstSession.id)
  })

  it('generates RS256 key material and intercepts remote JWKS validation', async () => {
    const fixture = await createRs256Fixture()
    const issuer = 'https://identity.example.test'
    const jwksUri = `${issuer}/jwks`
    const token = await fixture.sign({ aud: 'functional-client', iss: issuer, sub: 'user-1' })
    const expiredToken = await fixture.sign({
      aud: 'functional-client',
      exp: Math.trunc(Date.now() / 1000) - 60,
      iss: issuer,
      sub: 'expired-user',
    })
    const interceptor = interceptFetch([
      {
        url: jwksUri,
        respond: () => Response.json(fixture.jwks),
      },
    ])

    const { validateToken } = await import('../../src/runtime/server/utils/security')
    const payload = await validateToken(token, {
      audience: 'functional-client',
      issuer,
      jwksUri,
    })

    expect(payload.sub).toBe('user-1')
    await expect(
      validateToken(expiredToken, {
        audience: 'functional-client',
        issuer,
        jwksUri,
      }),
    ).rejects.toThrow()
    expect(fixture.publicJwk).toMatchObject({ alg: 'RS256', kid: 'functional-test-key' })
    expect(fixture.privateJwk.d).toEqual(expect.any(String))
    expect(interceptor.requests).toHaveLength(2)
    interceptor.restore()
  })
})
