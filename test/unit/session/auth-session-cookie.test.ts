import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createRequestEvent } from '../request-event'

const HTTP_ONLY_ATTRIBUTE = /;\s*HttpOnly/iu
const ROOT_PATH_ATTRIBUTE = /;\s*Path=\//iu
const SECURE_ATTRIBUTE = /;\s*Secure/iu
const SAME_SITE_ATTRIBUTE = /SameSite/iu

const runtimeConfig: { oidc: { session: { cookie?: Record<string, unknown> } } } = {
  oidc: { session: {} },
}

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt's virtual imports are unavailable outside its runtime.
vi.mock('#imports', () => ({
  useRuntimeConfig: () => runtimeConfig,
}))

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nitro storage requires its generated runtime; the auth session never touches it.
vi.mock('nitropack/runtime', () => ({
  useStorage: () => ({
    getItem: vi.fn<() => Promise<null>>(),
    removeItem: vi.fn<(key: string) => Promise<void>>(),
    setItem: vi.fn<(key: string, value: unknown) => Promise<void>>(),
  }),
}))

beforeEach(() => {
  vi.stubEnv('NUXT_OIDC_AUTH_SESSION_SECRET', 'test-auth-session-secret-at-least-32-characters')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

async function authSessionSetCookie(cookie: Record<string, unknown> | undefined): Promise<string> {
  runtimeConfig.oidc.session = cookie === undefined ? {} : { cookie }
  const { useAuthSession } = await import('../../../src/runtime/server/utils/session')
  const event = createRequestEvent()
  const session = await useAuthSession(event, 300)
  await session.update({ state: 'unit-state' })

  const header = event.node.res.getHeader('set-cookie')
  const values = Array.isArray(header) ? header : [String(header)]
  const authCookie = values.find((value) => value.startsWith('oidc='))
  if (authCookie === undefined) {
    throw new Error('The auth session cookie was not set')
  }
  return authCookie
}

describe('auth session cookie attributes', () => {
  it.each([
    { cookie: undefined, name: 'keeps Secure without cookie overrides', secure: true },
    { cookie: { sameSite: 'lax' }, name: 'keeps Secure without a secure flag', secure: true },
    {
      cookie: { sameSite: 'lax', secure: false },
      name: 'drops Secure for an explicit false',
      secure: false,
    },
    { cookie: { secure: true }, name: 'keeps Secure for an explicit true', secure: true },
    // A JSON runtime override such as NUXT_OIDC_SESSION_COOKIE='{"secure":null}' must not drop Secure.
    { cookie: { secure: null }, name: 'keeps Secure for a non-boolean override', secure: true },
    {
      cookie: { sameSite: 'strict', secure: false },
      name: 'does not forward sameSite',
      secure: false,
    },
  ])('$name', async ({ cookie, secure }) => {
    const authCookie = await authSessionSetCookie(cookie)

    expect(authCookie).toMatch(HTTP_ONLY_ATTRIBUTE)
    expect(authCookie).toMatch(ROOT_PATH_ATTRIBUTE)
    expect(SECURE_ATTRIBUTE.test(authCookie)).toBe(secure)
    expect(authCookie).not.toMatch(SAME_SITE_ATTRIBUTE)
  })
})
