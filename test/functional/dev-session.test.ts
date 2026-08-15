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
    ).resolves.toEqual({})
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

  it.each(['production', 'Production', 'PROD-preview'])(
    'rejects development login in %s environments',
    async (environment) => {
      vi.stubEnv('NODE_ENV', environment)
      const harness = new HandlerHarness({ runtimeConfig })
      const { devEventHandler } = await import('../../src/runtime/server/handler/dev')
      const handler = devEventHandler({
        onSuccess: async () => undefined,
      })

      await expect(
        handler(harness.createEvent({ path: '/auth/dev/login' }).event),
      ).rejects.toMatchObject({ statusCode: 404, message: 'Not Found' })
    },
  )
})
