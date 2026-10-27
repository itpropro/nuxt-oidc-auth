import { expect, it } from 'vitest'

import { HandlerHarness } from './handler-harness'

const issuer = 'https://identity.example.test'
const sessionId = 'removed-record-session'

it('clears a refreshable session without a token record when expiration checks are off', async () => {
  const harness = new HandlerHarness({
    runtimeConfig: {
      oidc: {
        session: { maxAge: 3600 },
        providers: {
          oidc: {
            clientId: 'functional-client',
            clientSecret: 'functional-secret',
            authorizationUrl: `${issuer}/authorize`,
            tokenUrl: `${issuer}/token`,
            redirectUri: 'https://app.example.test/auth/oidc/callback',
            sessionConfiguration: { automaticRefresh: false, expirationCheck: false },
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
    },
  })
  // A copy of the cookie of a session that logout or rotation already removed
  harness.cookieJar.seedSession(
    'nuxt-oidc-auth',
    {
      provider: 'oidc',
      canRefresh: true,
      expireAt: Math.trunc(Date.now() / 1000) + 3600,
      loggedInAt: 1,
      updatedAt: 1,
    },
    sessionId,
  )
  const request = harness.createEvent({ path: '/api/orders' })
  const { getUserSession } = await import('../../src/runtime/server/utils/session')

  const result: unknown = await getUserSession(request.event).catch((error: unknown) => error)
  request.commitResponseCookies()

  expect(result).toMatchObject({ statusCode: 401 })
  expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual({})
})
