import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createRequestEvent } from '../request-event'

const HTTP_ONLY_ATTRIBUTE = /;\s*HttpOnly/iu
const ROOT_PATH_ATTRIBUTE = /;\s*Path=\//iu
const SECURE_ATTRIBUTE = /;\s*Secure/iu
const SAME_SITE_ATTRIBUTE = /;\s*SameSite=(\w+)/iu

const runtimeConfig: { oidc: { session: { cookie: Record<string, unknown> } } } = {
  oidc: { session: { cookie: {} } },
}

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt's virtual imports are unavailable outside its runtime.
vi.mock('#imports', () => ({
  useRuntimeConfig: () => runtimeConfig,
}))

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nitro storage requires its generated runtime; the auth session never touches it.
vi.mock('nitropack/runtime', () => ({
  useStorage: () => ({}),
}))

beforeEach(() => {
  vi.stubEnv('NUXT_OIDC_AUTH_SESSION_SECRET', 'test-auth-session-secret-at-least-32-characters')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

async function authSessionSetCookie(
  cookie: Record<string, unknown>,
  cookieName: string,
): Promise<string> {
  runtimeConfig.oidc.session.cookie = cookie
  const { useAuthSession } = await import('../../../src/runtime/server/utils/session')
  const event = createRequestEvent()
  const session = await useAuthSession(event, 300)
  await session.update({ state: 'unit-state' })

  const header = event.node.res.getHeader('set-cookie')
  const values = Array.isArray(header) ? header : [String(header)]
  const authCookie = values.find((value) => value.startsWith(`${cookieName}=`))
  if (authCookie === undefined) {
    throw new Error('The auth session cookie was not set')
  }
  return authCookie
}

describe('auth session cookie attributes', () => {
  it.each([
    {
      cookie: { sameSite: 'lax' },
      cookieName: '__Host-oidc',
      name: 'uses a Secure __Host- cookie with SameSite=None without a secure flag',
      sameSite: 'None',
      secure: true,
    },
    {
      cookie: { sameSite: 'lax', secure: false },
      cookieName: 'oidc',
      name: 'drops Secure, the prefix and SameSite for an explicit false',
      sameSite: undefined,
      secure: false,
    },
    // NUXT_OIDC_SESSION_COOKIE_SECURE=0 reaches the config as a number; only boolean false drops Secure.
    {
      cookie: { sameSite: 'lax', secure: 0 },
      cookieName: '__Host-oidc',
      name: 'keeps the Secure cookie for a non-boolean flag',
      sameSite: 'None',
      secure: true,
    },
  ])('$name', async ({ cookie, cookieName, sameSite, secure }) => {
    const authCookie = await authSessionSetCookie(cookie, cookieName)

    expect(authCookie).toMatch(HTTP_ONLY_ATTRIBUTE)
    expect(authCookie).toMatch(ROOT_PATH_ATTRIBUTE)
    expect(SECURE_ATTRIBUTE.test(authCookie)).toBe(secure)
    expect(SAME_SITE_ATTRIBUTE.exec(authCookie)?.[1]).toBe(sameSite)
  })
})
