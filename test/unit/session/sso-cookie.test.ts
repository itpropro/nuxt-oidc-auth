import type { IncomingMessage, ServerResponse } from 'node:http'
import { createEvent, sealSession } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const storageMocks = vi.hoisted(() => ({
  getItem: vi.fn<() => Promise<null>>(),
  removeItem: vi.fn<(key: string) => Promise<void>>(),
  setItem: vi.fn<(key: string, value: unknown) => Promise<void>>(),
}))

const runtimeConfig = {
  oidc: {
    providers: { oidc: {} },
    session: {
      automaticRefresh: false,
      expirationCheck: true,
      maxAge: 3600,
    },
  },
}

vi.mock('#imports', () => ({
  useRuntimeConfig: () => runtimeConfig,
}))

vi.mock('nitropack/runtime', () => ({
  useStorage: () => storageMocks,
}))

beforeEach(() => {
  vi.stubEnv('NUXT_OIDC_SESSION_SECRET', 'test-session-secret-at-least-32-characters')
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function createRequestEvent(cookie: string) {
  const responseHeaders = new Map<string, string | string[]>()
  const request = {
    headers: { cookie },
    method: 'GET',
    url: '/api/_auth/sso',
  } as IncomingMessage
  const response = {
    getHeader: (name: string) => responseHeaders.get(name.toLowerCase()),
    headersSent: false,
    removeHeader: (name: string) => responseHeaders.delete(name.toLowerCase()),
    setHeader: (name: string, value: string | string[]) => {
      responseHeaders.set(name.toLowerCase(), value)
    },
    statusCode: 200,
    writableEnded: false,
  } as unknown as ServerResponse
  return { event: createEvent(request, response), responseHeaders }
}

async function createSignedCookie(
  data: Record<string, unknown>,
  createdAt: number = Date.now(),
): Promise<string> {
  const { event } = createRequestEvent('')
  event.context.sessions = {
    'nuxt-oidc-auth': {
      createdAt,
      data,
      id: 'signed-session',
    },
  }
  const sealed = await sealSession(event, {
    maxAge: 3600,
    name: 'nuxt-oidc-auth',
    password: 'test-session-secret-at-least-32-characters',
  })
  return `nuxt-oidc-auth=${encodeURIComponent(sealed)}`
}

describe('single sign-out session cookie authorization', () => {
  it.each([
    { cookie: 'nuxt-oidc-auth=', name: 'empty' },
    { cookie: 'nuxt-oidc-auth=invalid', name: 'invalid' },
  ])('rejects an $name cookie without replacing it', async ({ cookie }) => {
    const { event, responseHeaders } = createRequestEvent(cookie)
    const handler = (await import('../../../src/runtime/server/api/sso')).default

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })

    expect(responseHeaders.has('set-cookie')).toBe(false)
    expect(event.context.sessions).toBeUndefined()
    expect(storageMocks.getItem).not.toHaveBeenCalled()
    expect(storageMocks.removeItem).not.toHaveBeenCalled()
    expect(storageMocks.setItem).not.toHaveBeenCalled()
  })

  it.each([
    {
      data: {
        canRefresh: false,
        expireAt: Math.trunc(Date.now() / 1000) - 1,
        provider: 'oidc',
        singleSignOut: true,
      },
      name: 'expired user session',
    },
    {
      data: {
        canRefresh: false,
        expireAt: Math.trunc(Date.now() / 1000) + 3600,
        provider: 'unknown',
        singleSignOut: true,
      },
      name: 'unknown provider',
    },
    {
      data: {
        canRefresh: false,
        expireAt: Math.trunc(Date.now() / 1000) + 3600,
        provider: 'oidc',
        singleSignOut: 'true',
      },
      name: 'non-boolean opt-in',
    },
    {
      data: {
        canRefresh: false,
        expireAt: Math.trunc(Date.now() / 1000) + 3600,
        provider: 'oidc',
        singleSignOut: false,
      },
      name: 'disabled single sign-out',
    },
  ])('rejects a signed cookie with $name without side effects', async ({ data }) => {
    const cookie = await createSignedCookie(data)
    const { event, responseHeaders } = createRequestEvent(cookie)
    const handler = (await import('../../../src/runtime/server/api/sso')).default

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })

    expect(responseHeaders.has('set-cookie')).toBe(false)
    expect(event.context.sessions).toBeUndefined()
    expect(storageMocks.getItem).not.toHaveBeenCalled()
    expect(storageMocks.removeItem).not.toHaveBeenCalled()
    expect(storageMocks.setItem).not.toHaveBeenCalled()
  })

  it('rejects an expired signed envelope without side effects', async () => {
    const now = Date.now()
    const cookie = await createSignedCookie(
      {
        canRefresh: false,
        expireAt: Math.trunc(now / 1000) + 3600,
        provider: 'oidc',
        singleSignOut: true,
      },
      now - 3_601_000,
    )
    const { event, responseHeaders } = createRequestEvent(cookie)
    const handler = (await import('../../../src/runtime/server/api/sso')).default

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })

    expect(responseHeaders.has('set-cookie')).toBe(false)
    expect(event.context.sessions).toBeUndefined()
    expect(storageMocks.getItem).not.toHaveBeenCalled()
    expect(storageMocks.removeItem).not.toHaveBeenCalled()
    expect(storageMocks.setItem).not.toHaveBeenCalled()
  })
})
