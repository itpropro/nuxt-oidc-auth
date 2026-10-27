import { afterEach, expect, it, vi } from 'vitest'

import * as providerPresets from '../../src/runtime/providers'
import { createProviderRuntimeConfig } from '../../src/runtime/server/utils/config'
import { encryptToken } from '../../src/runtime/server/utils/security'
import { HandlerHarness, interceptFetch } from './handler-harness'
import { inSeconds, tokenKey } from './refresh-harness'

const issuer = 'https://identity.example.test'

// Built like the module's runtime config, where provider options that are not set hold a sentinel
const harness = new HandlerHarness({
  runtimeConfig: {
    oidc: {
      session: {
        automaticRefresh: false,
        expirationCheck: true,
        expirationThreshold: 600,
        maxAge: 3600,
        missingPersistentSession: 'clear',
      },
      providers: {
        oidc: createProviderRuntimeConfig(
          {
            clientId: 'functional-client',
            clientSecret: 'functional-secret',
            authorizationUrl: `${issuer}/authorize`,
            tokenUrl: `${issuer}/token`,
            redirectUri: 'https://app.example.test/auth/oidc/callback',
          },
          providerPresets.oidc,
        ),
        keycloak: createProviderRuntimeConfig(
          {
            baseUrl: `${issuer}/realms/functional`,
            clientId: 'functional-client',
            clientSecret: 'functional-secret',
            redirectUri: 'https://app.example.test/auth/keycloak/callback',
            sessionConfiguration: { expirationThreshold: 120 },
          },
          providerPresets.keycloak,
        ),
      },
    },
  },
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function getSessionExpiringIn(provider: 'keycloak' | 'oidc', seconds: number) {
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  const sessionId = `${provider}-session`
  harness.cookieJar.seedSession(
    'nuxt-oidc-auth',
    { provider, canRefresh: true, expireAt: inSeconds(seconds), loggedInAt: 1, updatedAt: 1 },
    sessionId,
  )
  await harness.storage('oidc').setItem(sessionId, {
    createdAt: new Date(),
    updatedAt: new Date(),
    exp: inSeconds(seconds),
    iat: 1,
    accessToken: await encryptToken('access-token', tokenKey),
    refreshToken: await encryptToken('refresh-token', tokenKey),
  })
  const providerRequests = interceptFetch([]).requests
  const request = harness.createEvent({ path: '/api/orders' })
  const { getUserSession } = await import('../../src/runtime/server/utils/session')
  const result: unknown = await getUserSession(request.event).catch((error: unknown) => error)
  return { providerRequests, result }
}

it('applies the global session options to a provider that does not set them', async () => {
  const { providerRequests, result } = await getSessionExpiringIn('oidc', 300)

  // Expiring within the global threshold, and automatic refresh is off globally
  expect(result).toMatchObject({ statusCode: 401, message: 'Session expired' })
  expect(providerRequests).toStrictEqual([])
})

it('prefers the session options a provider sets over the global ones', async () => {
  const { providerRequests, result } = await getSessionExpiringIn('keycloak', 300)

  expect(result).toMatchObject({ provider: 'keycloak', canRefresh: true })
  expect(providerRequests).toStrictEqual([])
})
