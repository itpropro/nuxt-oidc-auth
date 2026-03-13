/**
 * Sliding Session Expiry Tests
 *
 * Verifies that session cookie expiry slides forward on token refresh.
 * Without this fix, h3 useSession computes cookie Expires from the original
 * session.createdAt (set at login), so users can be logged out at the
 * original maxAge boundary even after successful token refreshes.
 */

import type { H3Event } from 'h3'
import { describe, expect, it, vi } from 'vitest'

const SESSION_NAME = 'nuxt-oidc-auth'

const mockEncryptedToken = { encryptedToken: 'encrypted', iv: 'iv' }
const mockProviderConfig = {
  clientId: 'test',
  clientSecret: 'secret',
  authorizationUrl: 'https://example.com/auth',
  tokenUrl: 'https://example.com/token',
  requiredProperties: ['clientId'],
  sessionConfiguration: {},
  exposeAccessToken: false,
  exposeIdToken: false,
}

vi.mock('#imports', () => ({
  useRuntimeConfig: () => ({
    oidc: {
      session: { maxAge: 1800 },
      providers: {
        oidc: mockProviderConfig,
      },
    },
  }),
}))

vi.mock('../../../src/runtime/server/utils/oidc', () => ({
  useOidcLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  configMerger: (_runtime: unknown, _preset: unknown) => mockProviderConfig,
  refreshAccessToken: vi.fn().mockResolvedValue({
    user: { provider: 'oidc', userName: 'test-user' },
    tokens: {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    },
    expiresIn: '3600',
    parsedAccessToken: {
      exp: Math.trunc(Date.now() / 1000) + 3600,
      iat: Math.trunc(Date.now() / 1000),
    },
  }),
}))

vi.mock('../../../src/runtime/server/utils/security', () => ({
  encryptToken: vi.fn().mockResolvedValue(mockEncryptedToken),
  decryptToken: vi.fn().mockResolvedValue('decrypted-refresh-token'),
}))

vi.mock('nitropack/runtime', () => ({
  useStorage: () => ({
    getItem: vi.fn().mockResolvedValue({
      createdAt: new Date(Date.now() - 3600_000),
      updatedAt: new Date(Date.now() - 1800_000),
      exp: Math.trunc(Date.now() / 1000) + 1800,
      iat: Math.trunc(Date.now() / 1000) - 1800,
      accessToken: mockEncryptedToken,
      refreshToken: mockEncryptedToken,
    }),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  }),
}))

vi.mock('../../../src/runtime/providers', () => ({
  oidc: {
    sessionConfiguration: {},
    exposeAccessToken: false,
    exposeIdToken: false,
  },
}))

vi.mock('hookable', () => ({
  createHooks: () => ({
    callHookParallel: vi.fn(),
    hook: vi.fn(),
  }),
}))

function createMockEvent(sessionCreatedAt: number): H3Event {
  const rawSession = {
    id: 'test-session-id',
    createdAt: sessionCreatedAt,
    data: {
      provider: 'oidc',
      canRefresh: true,
      loggedInAt: Math.trunc(sessionCreatedAt / 1000),
    },
  }

  const sessionManager = {
    id: rawSession.id,
    data: rawSession.data,
    update: vi.fn(async (update: Record<string, unknown>) => {
      Object.assign(rawSession.data, update)
      return sessionManager
    }),
    clear: vi.fn(),
  }

  return {
    context: {
      sessions: {
        [SESSION_NAME]: rawSession,
      },
    },
    node: { req: { headers: {} }, res: { setHeader: vi.fn() } },
  } as unknown as H3Event
}

// Mock h3 useSession to return a manager backed by event.context.sessions
vi.mock('h3', async () => {
  const actual = await vi.importActual<typeof import('h3')>('h3')
  return {
    ...actual,
    useSession: vi.fn(async (event: H3Event, config: { name?: string }) => {
      const name = config.name || SESSION_NAME
      const raw = event.context.sessions![name]!
      return {
        id: raw.id,
        data: raw.data,
        update: vi.fn(async (update: Record<string, unknown>) => {
          Object.assign(raw.data, update)
          return { id: raw.id, data: raw.data }
        }),
        clear: vi.fn(),
      }
    }),
    createError: actual.createError,
    deleteCookie: vi.fn(),
    sendRedirect: vi.fn(),
    setCookie: vi.fn(),
  }
})

describe('sliding session expiry', () => {
  it('should update session createdAt on token refresh to slide cookie expiry', async () => {
    const originalCreatedAt = Date.now() - 3600_000
    const event = createMockEvent(originalCreatedAt)

    process.env.NUXT_OIDC_SESSION_SECRET = 'a]V3[#K+C5w4FS,>Y<H*CKz{N8R)k|K'
    process.env.NUXT_OIDC_TOKEN_KEY = 'dGVzdC1rZXktMzItYnl0ZXMtbG9uZy4u'
    process.env.NUXT_OIDC_AUTH_SESSION_SECRET = 'test-auth-session-secret-32chars!'

    const { refreshUserSession } = await import('../../../src/runtime/server/utils/session')

    const beforeRefresh = Date.now()
    await refreshUserSession(event)
    const afterRefresh = Date.now()

    const rawSession = event.context.sessions![SESSION_NAME]!
    expect(rawSession.createdAt).toBeGreaterThanOrEqual(beforeRefresh)
    expect(rawSession.createdAt).toBeLessThanOrEqual(afterRefresh)
    expect(rawSession.createdAt).not.toBe(originalCreatedAt)
  })
})
