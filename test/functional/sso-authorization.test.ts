import { afterEach, describe, expect, it, vi } from 'vitest'
import { HandlerHarness } from './handler-harness'

const runtimeConfig = {
  oidc: {
    session: {
      automaticRefresh: false,
      expirationCheck: true,
      maxAge: 3600,
      missingPersistentSession: 'silent',
    },
    providers: {
      oidc: {
        authorizationUrl: 'https://identity.example.test/authorize',
        clientId: 'functional-client',
        clientSecret: 'functional-secret',
        redirectUri: 'https://app.example.test/auth/oidc/callback',
        requiredProperties: [
          'clientId',
          'clientSecret',
          'authorizationUrl',
          'tokenUrl',
          'redirectUri',
        ],
        sessionConfiguration: {
          automaticRefresh: false,
          expirationCheck: true,
          missingPersistentSession: 'silent',
          singleSignOut: true,
        },
        tokenUrl: 'https://identity.example.test/token',
      },
    },
  },
}

afterEach(() => {
  vi.restoreAllMocks()
})

function seedUserSession(
  harness: HandlerHarness,
  options: { canRefresh?: boolean; singleSignOut: boolean },
): string {
  const sessionId = `sso-${options.singleSignOut}-${options.canRefresh ?? false}`
  const now = Math.trunc(Date.now() / 1000)
  harness.cookieJar.seedSession(
    'nuxt-oidc-auth',
    {
      provider: 'oidc',
      canRefresh: options.canRefresh ?? false,
      expireAt: now + 3600,
      loggedInAt: now,
      singleSignOut: options.singleSignOut,
      updatedAt: now,
    },
    sessionId,
  )
  return sessionId
}

describe('single sign-out stream authorization', () => {
  it('rejects anonymous callers without allocating resources', async () => {
    const harness = new HandlerHarness({ runtimeConfig })
    const handler = (await import('../../src/runtime/server/api/sso')).default
    const request = harness.createEvent({ path: '/api/_auth/sso' })

    await expect(handler(request.event)).rejects.toMatchObject({ statusCode: 401 })

    expect(request.response.eventStream).toBeUndefined()
    expect(request.response.headers).not.toHaveProperty('set-cookie')
    expect(harness.inspectStorage('oidc').size).toBe(0)
  })

  it('rejects sessions not opted into single sign-out', async () => {
    const harness = new HandlerHarness({ runtimeConfig })
    seedUserSession(harness, { singleSignOut: false })
    const handler = (await import('../../src/runtime/server/api/sso')).default
    const request = harness.createEvent({ path: '/api/_auth/sso' })

    await expect(handler(request.event)).rejects.toMatchObject({ statusCode: 401 })

    expect(request.response.eventStream).toBeUndefined()
    expect(request.response.headers).not.toHaveProperty('set-cookie')
  })

  it('opens an opted-in stream and cleans up after logout', async () => {
    const harness = new HandlerHarness({ runtimeConfig })
    const sessionId = seedUserSession(harness, { singleSignOut: true })
    await harness.storage('oidc').setItem(sessionId, { marker: true })
    const handler = (await import('../../src/runtime/server/api/sso')).default
    const request = harness.createEvent({ path: '/api/_auth/sso' })

    await handler(request.event)

    expect(request.response.eventStream).toMatchObject({ sent: true, messages: [] })
    const { logoutHooks } = await import('../../src/runtime/server/utils/session')
    await logoutHooks.callHookParallel(sessionId)
    await Promise.resolve()

    expect(request.response.eventStream?.messages).toEqual([{ event: 'logout', data: '' }])
    expect(harness.inspectStorage('oidc').has(sessionId)).toBe(false)
    await request.response.eventStream?.close()
    expect(request.response.eventStream?.closed).toBe(true)
  })

  it('clears opted-in refreshable sessions missing persistent state', async () => {
    const harness = new HandlerHarness({ runtimeConfig })
    seedUserSession(harness, { canRefresh: true, singleSignOut: true })
    const handler = (await import('../../src/runtime/server/api/sso')).default
    const request = harness.createEvent({ path: '/api/_auth/sso' })

    await expect(handler(request.event)).rejects.toMatchObject({ statusCode: 401 })

    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toEqual({})
    expect(request.response.eventStream).toBeUndefined()
    expect(request.response.headers['set-cookie']).toEqual(
      expect.arrayContaining(['nuxt-oidc-auth=; Max-Age=0; Path=/']),
    )
  })
})
