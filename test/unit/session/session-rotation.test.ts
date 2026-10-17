import type { H3Event } from 'h3'
import { sealSession, unsealSession } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getUserSessionId, rotateUserSession } from '../../../src/runtime/server/utils/session'
import type { PersistentSession, UserSession } from '../../../src/runtime/types'
import { createRequestEvent } from '../request-event'

const SESSION_NAME = 'nuxt-oidc-auth'
const SESSION_SECRET = 'test-session-secret-at-least-32-characters'
const PREVIOUS_SESSION_ID = 'previous-session-id'
const HTTP_ONLY = /; HttpOnly(?:;|$)/u
const SAME_SITE_LAX = /; SameSite=Lax(?:;|$)/u
const persistentSessions = new Map<string, PersistentSession>()
const runtimeConfig = {
  oidc: { session: { maxAge: 3600, cookie: { sameSite: 'lax' } }, providers: {} },
}

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt's virtual imports are unavailable outside its runtime.
vi.mock('#imports', () => ({ useRuntimeConfig: () => runtimeConfig }))

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nitro storage requires its generated runtime; the memory store keeps the stored records observable.
vi.mock('nitropack/runtime', () => ({
  useStorage: () => ({
    getItem: async (key: string) => persistentSessions.get(key) ?? null,
    setItem: async (key: string, value: PersistentSession) => {
      persistentSessions.set(key, value)
    },
    removeItem: async (key: string) => {
      persistentSessions.delete(key)
    },
  }),
}))

function persistentSession(accessToken: string): PersistentSession {
  return {
    createdAt: new Date(),
    updatedAt: new Date(),
    exp: Math.trunc(Date.now() / 1000) + 300,
    iat: Math.trunc(Date.now() / 1000),
    accessToken: { encryptedToken: accessToken, iv: 'iv' },
  }
}

function user(overrides: Partial<UserSession> = {}): UserSession {
  return {
    provider: 'oidc',
    canRefresh: true,
    tokensStored: true,
    expireAt: Math.trunc(Date.now() / 1000) + 300,
    userName: 'account-b',
    ...overrides,
  }
}

async function requestWithPreviousSession(): Promise<H3Event> {
  const seedEvent = createRequestEvent()
  seedEvent.context.sessions = {
    [SESSION_NAME]: {
      id: PREVIOUS_SESSION_ID,
      createdAt: Date.now(),
      data: {
        provider: 'oidc',
        canRefresh: true,
        expireAt: Math.trunc(Date.now() / 1000) + 300,
        userName: 'account-a',
        userInfo: { displayName: 'Account A' },
        applicationData: { theme: 'dark' },
      },
    },
  }
  const sealed = await sealSession(seedEvent, { name: SESSION_NAME, password: SESSION_SECRET })
  persistentSessions.set(PREVIOUS_SESSION_ID, persistentSession('account-a'))
  return createRequestEvent(`${SESSION_NAME}=${sealed}`)
}

function sessionCookie(event: H3Event): string | undefined {
  const header = event.node.res.getHeader('set-cookie')
  const cookies = Array.isArray(header) ? header : [header]
  return cookies.find(
    (cookie): cookie is string =>
      typeof cookie === 'string' && cookie.startsWith(`${SESSION_NAME}=`),
  )
}

beforeEach(() => {
  vi.stubEnv('NUXT_OIDC_SESSION_SECRET', SESSION_SECRET)
})

afterEach(() => {
  vi.unstubAllEnvs()
  persistentSessions.clear()
})

describe('user session rotation', () => {
  it('seals a session cookie under a new ID that holds the new tokens', async () => {
    const event = await requestWithPreviousSession()

    await expect(rotateUserSession(event, user(), persistentSession('account-b'))).resolves.toBe(
      true,
    )

    const cookie = sessionCookie(event) ?? ''
    expect(cookie).toMatch(HTTP_ONLY)
    expect(cookie).toMatch(SAME_SITE_LAX)
    const nameAndValue = cookie.slice(0, cookie.indexOf(';'))
    expect(nameAndValue.length).toBeLessThanOrEqual(4096)
    const rotated = await unsealSession(
      event,
      { name: SESSION_NAME, password: SESSION_SECRET },
      decodeURIComponent(nameAndValue.slice(SESSION_NAME.length + 1)),
    )
    if (rotated.id === undefined) {
      throw new Error('Rotated session has no ID')
    }
    expect(rotated.id).not.toBe(PREVIOUS_SESSION_ID)
    await expect(getUserSessionId(event)).resolves.toBe(rotated.id)
    expect(rotated.data).toStrictEqual({ ...user(), applicationData: { theme: 'dark' } })
    expect([...persistentSessions.keys()]).toStrictEqual([rotated.id])
    expect(persistentSessions.get(rotated.id)?.accessToken.encryptedToken).toBe('account-b')
  })

  it('keeps the previous session when the sealed cookie would exceed 4096 bytes', async () => {
    const event = await requestWithPreviousSession()

    await expect(
      rotateUserSession(
        event,
        user({ userInfo: { profile: 'x'.repeat(4096) } }),
        persistentSession('account-b'),
      ),
    ).resolves.toBe(false)

    expect(sessionCookie(event)).toBeUndefined()
    await expect(getUserSessionId(event)).resolves.toBe(PREVIOUS_SESSION_ID)
    expect([...persistentSessions.keys()]).toStrictEqual([PREVIOUS_SESSION_ID])
    expect(persistentSessions.get(PREVIOUS_SESSION_ID)?.accessToken.encryptedToken).toBe(
      'account-a',
    )
  })
})
