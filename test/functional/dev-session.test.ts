import { afterEach, describe, expect, it, vi } from 'vitest'

import { HandlerHarness } from './handler-harness'

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
      },
    },
  },
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('development sessions', () => {
  it('redirects development login inside a custom application base', async () => {
    const harness = new HandlerHarness({
      runtimeConfig: {
        ...runtimeConfig,
        app: { baseURL: '/prefix/' },
      },
    })
    const handler = (await import('../../src/runtime/server/handler/dev')).default

    const defaultRequest = harness.createEvent({ path: '/auth/dev/login' })
    await handler(defaultRequest.event)
    expect(defaultRequest.response).toMatchObject({ status: 302, location: '/prefix/' })

    const targetRequest = harness.createEvent({
      path: '/auth/dev/login',
      query: { callbackRedirectUrl: '/prefix/account' },
    })
    await handler(targetRequest.event)
    expect(targetRequest.response).toMatchObject({ status: 302, location: '/prefix/account' })
  })

  it('starts a new session for a development login', async () => {
    const harness = new HandlerHarness({ runtimeConfig })
    const previousSession = harness.cookieJar.seedSession('nuxt-oidc-auth', {
      provider: 'oidc',
      canRefresh: true,
      expireAt: Math.trunc(Date.now() / 1000) + 300,
      claims: { role: 'admin' },
      applicationData: { theme: 'dark' },
    })
    await harness.storage('oidc').setItem(previousSession.id, { accessToken: 'previous' })
    const handler = (await import('../../src/runtime/server/handler/dev')).default

    const request = harness.createEvent({ path: '/auth/dev/login' })
    await handler(request.event)
    request.commitResponseCookies()

    const session = harness.inspectSession('nuxt-oidc-auth')
    expect(session?.id).not.toBe(previousSession.id)
    expect(harness.cookieJar.get('nuxt-oidc-auth')).toBe(session?.id)
    expect(harness.inspectStorage('oidc').size).toBe(0)
    expect(session?.data).toMatchObject({ provider: 'dev', applicationData: { theme: 'dark' } })
    expect(session?.data).not.toHaveProperty('claims')
  })

  it('returns development sessions without resolving a provider preset', async () => {
    const harness = new HandlerHarness({ runtimeConfig })
    const expireAt = Math.trunc(Date.now() / 1000) + 300
    harness.cookieJar.seedSession('nuxt-oidc-auth', {
      provider: 'dev',
      canRefresh: false,
      expireAt,
      loggedInAt: expireAt - 60,
      updatedAt: expireAt - 60,
      claims: { role: 'developer' },
    })
    const { getUserSession } = await import('../../src/runtime/server/utils/session')

    await expect(
      getUserSession(harness.createEvent({ path: '/api/test/session' }).event),
    ).resolves.toMatchObject({
      provider: 'dev',
      claims: { role: 'developer' },
      expireAt,
    })
  })

  it('keeps anonymous API responses empty', async () => {
    const harness = new HandlerHarness({ runtimeConfig })
    const sessionHandler = (await import('../../src/runtime/server/api/session.get')).default

    await expect(
      sessionHandler(harness.createEvent({ path: '/api/_auth/session' }).event),
    ).resolves.toStrictEqual({})
  })

  it('surfaces unknown session providers as controlled errors', async () => {
    const harness = new HandlerHarness({ runtimeConfig })
    harness.cookieJar.seedSession('nuxt-oidc-auth', {
      provider: 'unknown',
      canRefresh: false,
      expireAt: Math.trunc(Date.now() / 1000) + 300,
    })
    const sessionHandler = (await import('../../src/runtime/server/api/session.get')).default

    await expect(
      sessionHandler(harness.createEvent({ path: '/api/_auth/session' }).event),
    ).rejects.toMatchObject({
      statusCode: 500,
      message: 'Unknown OIDC provider: unknown',
    })
  })

  it.each([
    { site: 'cross-site', provider: 'dev' },
    { site: 'same-site', provider: 'dev' },
    { site: 'same-origin', provider: undefined },
  ])('handles a $site development logout', async ({ site, provider }) => {
    const harness = new HandlerHarness({ runtimeConfig })
    harness.cookieJar.seedSession('nuxt-oidc-auth', {
      provider: 'dev',
      canRefresh: false,
      expireAt: Math.trunc(Date.now() / 1000) + 300,
    })
    const handler = (await import('../../src/runtime/server/handler/logout.get')).default

    const request = harness.createEvent({
      path: '/auth/dev/logout',
      headers: { 'sec-fetch-site': site },
    })
    await handler(request.event)

    expect(request.response).toMatchObject({ status: 302, location: 'https://app.example.test' })
    expect(harness.inspectSession('nuxt-oidc-auth')?.data['provider']).toBe(provider)
  })

  it.each(['production', 'Production', 'PROD-preview'])(
    'rejects development login in %s environments',
    async (environment) => {
      vi.stubEnv('NODE_ENV', environment)
      const harness = new HandlerHarness({ runtimeConfig })
      const { devEventHandler } = await import('../../src/runtime/server/handler/dev')
      const handler = devEventHandler({
        onSuccess: async () => {},
      })

      await expect(
        handler(harness.createEvent({ path: '/auth/dev/login' }).event),
      ).rejects.toMatchObject({ statusCode: 404, message: 'Not Found' })
    },
  )
})
