import { afterEach, expect, it, vi } from 'vitest'

import { clearUserSession } from '../../../src/runtime/server/utils/session'
import { createRequestEvent } from '../request-event'

// The __Host-Http- prefix requires both Secure and HttpOnly
const SESSION_NAME = '__Host-Http-app-session'
const MAX_AGE_ZERO = /;\s*Max-Age=0(?:;|$)/iu
const SECURE = /;\s*Secure(?:;|$)/iu
const HTTP_ONLY = /;\s*HttpOnly(?:;|$)/iu
const runtimeConfig = {
  oidc: { session: { cookieName: SESSION_NAME, cookie: { secure: true } }, providers: {} },
}

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt's virtual imports are unavailable outside its runtime.
vi.mock('#imports', () => ({ useRuntimeConfig: () => runtimeConfig }))

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nitro storage requires its generated runtime; this session has no stored tokens.
vi.mock('nitropack/runtime', () => ({
  useStorage: () => ({
    getItem: async () => null,
    removeItem: async () => {},
  }),
}))

afterEach(() => {
  vi.unstubAllEnvs()
})

it('deletes a prefixed session cookie with the attributes browsers require', async () => {
  vi.stubEnv('NUXT_OIDC_SESSION_SECRET', 'test-session-secret-at-least-32-characters')
  const event = createRequestEvent()
  event.context.sessions = {
    [SESSION_NAME]: {
      id: 'prefixed-session',
      createdAt: Date.now(),
      data: { provider: 'oidc', canRefresh: false, expireAt: 1 },
    },
  }

  await clearUserSession(event)

  const header = event.node.res.getHeader('set-cookie')
  const sessionCookies = (Array.isArray(header) ? header : [String(header)]).filter((cookie) =>
    cookie.startsWith(`${SESSION_NAME}=`),
  )
  expect(sessionCookies).toHaveLength(1)
  expect(sessionCookies[0]).toMatch(MAX_AGE_ZERO)
  expect(sessionCookies[0]).toMatch(SECURE)
  expect(sessionCookies[0]).toMatch(HTTP_ONLY)
})
