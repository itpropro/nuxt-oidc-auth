import { setTimeout } from 'node:timers/promises'

import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { encryptToken } from '../../src/runtime/server/utils/security'
import { interceptFetch } from './handler-harness'
import {
  createHarness,
  getSession,
  inSeconds,
  refreshedTokens,
  refreshTokenOf,
  seedSession,
  sessionId,
  tokenKey,
  tokenRoute,
} from './refresh-harness'

const refusedRefresh = () => Response.json({ error: 'invalid_grant' }, { status: 400 })

function expireAtOf(session: unknown): unknown {
  return typeof session === 'object' && session !== null && 'expireAt' in session
    ? session.expireAt
    : undefined
}

beforeEach(() => {
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  vi.stubEnv('NUXT_OIDC_TOKEN_KEY', tokenKey)
})

afterEach(() => {
  vi.restoreAllMocks()
})

it('refreshes concurrent requests of an expired session once', async () => {
  const harness = createHarness()
  await seedSession(harness)
  const sentRefreshTokens: (string | null)[] = []
  interceptFetch([
    tokenRoute(async (request) => {
      const refreshToken = await refreshTokenOf(request)
      // Like a provider that rotates refresh tokens, accept each one once
      const reused = sentRefreshTokens.includes(refreshToken)
      sentRefreshTokens.push(refreshToken)
      await setTimeout(10)
      return reused ? refusedRefresh() : refreshedTokens()
    }),
  ])

  const refreshedFrom = inSeconds(3600)
  const sessions = await Promise.all([getSession(harness), getSession(harness)])

  expect(sentRefreshTokens).toStrictEqual(['initial-refresh-token'])
  // Each request applies the shared refresh to its own session
  for (const session of sessions) {
    expect(session).toMatchObject({ provider: 'oidc', canRefresh: true })
    expect(expireAtOf(session)).toBeGreaterThanOrEqual(refreshedFrom)
  }
  expect(harness.inspectStorage('oidc').get(sessionId)?.['exp']).toBeGreaterThan(inSeconds(0))
})

it('refreshes with the token another server process stored after the provider refused the old one', async () => {
  const harness = createHarness()
  const seededSession = await seedSession(harness)
  const sentRefreshTokens: (string | null)[] = []
  interceptFetch([
    tokenRoute(async (request) => {
      const refreshToken = await refreshTokenOf(request)
      sentRefreshTokens.push(refreshToken)
      if (refreshToken !== 'initial-refresh-token') {
        return refreshedTokens()
      }
      // Another server process refreshed the session with the same token first
      await harness.storage('oidc').setItem(sessionId, {
        ...seededSession,
        exp: inSeconds(3600),
        refreshToken: await encryptToken('other-process-refresh-token', tokenKey),
      })
      return refusedRefresh()
    }),
  ])

  const refreshedFrom = inSeconds(3600)
  const session = await getSession(harness)

  expect(session).toMatchObject({ provider: 'oidc', canRefresh: true })
  expect(expireAtOf(session)).toBeGreaterThanOrEqual(refreshedFrom)
  expect(sentRefreshTokens).toStrictEqual(['initial-refresh-token', 'other-process-refresh-token'])
  expect(harness.inspectStorage('oidc').has(sessionId)).toBe(true)
})
