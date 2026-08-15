import type { IncomingMessage, ServerResponse } from 'node:http'
import { createEvent } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeConfig = {
  oidc: {
    providers: {},
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
  useStorage: () => ({
    getItem: vi.fn<() => Promise<null>>(),
    removeItem: vi.fn<(key: string) => Promise<void>>(),
    setItem: vi.fn<(key: string, value: unknown) => Promise<void>>(),
  }),
}))

beforeEach(() => {
  vi.stubEnv('NUXT_OIDC_SESSION_SECRET', 'test-session-secret-at-least-32-characters')
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
  })
})
