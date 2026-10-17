import { expect } from 'vitest'

import type { OidcProviderConfig } from '../../src/runtime/server/utils/provider'
import { encryptToken } from '../../src/runtime/server/utils/security'
import type { SessionBehaviorOptions } from '../../src/runtime/server/utils/session'
import type { FetchRoute } from './handler-harness'
import { HandlerHarness } from './handler-harness'

export const issuer = 'https://identity.example.test'
export const tokenUrl = `${issuer}/token`
export const jwksUri = `${issuer}/jwks`
export const discoveryUrl = `${issuer}/.well-known/openid-configuration`
export const clientId = 'functional-client'
export const clientSecret = 'refresh-outage-secret'
export const tokenKey = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY='
export const sessionId = 'refresh-outage-session'
export const seededUserSession = {
  provider: 'oidc',
  canRefresh: true,
  expireAt: 1,
  loggedInAt: 1,
  updatedAt: 1,
}

export type TokenAnswer = (request: Request) => Response | Promise<Response>

// The module keeps the session settings of the first configuration it reads, so tests in one file share them.
export function createHarness(overrides: Partial<OidcProviderConfig> = {}) {
  return new HandlerHarness({
    runtimeConfig: {
      oidc: {
        session: { automaticRefresh: true, expirationCheck: true, maxAge: 3600 },
        providers: {
          oidc: {
            clientId,
            clientSecret,
            authorizationUrl: `${issuer}/authorize`,
            tokenUrl,
            redirectUri: 'https://app.example.test/auth/oidc/callback',
            tokenRequestType: 'form-urlencoded',
            sessionConfiguration: { expirationThreshold: 300 },
            skipAccessTokenParsing: true,
            validateAccessToken: false,
            validateIdToken: false,
            requiredProperties: [
              'clientId',
              'clientSecret',
              'authorizationUrl',
              'tokenUrl',
              'redirectUri',
            ],
            ...overrides,
          },
        },
      },
    },
  })
}

export async function seedSession(
  harness: HandlerHarness,
  persistent: Record<string, unknown> = {},
  expireAt = 1,
) {
  harness.cookieJar.seedSession('nuxt-oidc-auth', { ...seededUserSession, expireAt }, sessionId)
  await harness.storage('oidc').setItem(sessionId, {
    createdAt: new Date(),
    updatedAt: new Date(),
    exp: expireAt,
    iat: 1,
    accessToken: await encryptToken('initial-access-token', tokenKey),
    refreshToken: await encryptToken('initial-refresh-token', tokenKey),
    ...persistent,
  })
  return harness.inspectStorage('oidc').get(sessionId)!
}

export function refreshedTokens() {
  return Response.json({
    access_token: 'refreshed-access-token',
    expires_in: '3600',
    refresh_token: 'rotated-refresh-token',
    token_type: 'Bearer',
  })
}

export function tokenRoute(answer: TokenAnswer): FetchRoute {
  return { method: 'POST', url: tokenUrl, respond: answer }
}

export async function refreshTokenOf(request: Request) {
  return new URLSearchParams(await request.text()).get('refresh_token')
}

export async function refresh(harness: HandlerHarness, options?: SessionBehaviorOptions) {
  const request = harness.createEvent({ path: '/api/_auth/refresh' })
  const { refreshUserSession } = await import('../../src/runtime/server/utils/session')
  const result: unknown = await refreshUserSession(request.event, options).catch(
    (error: unknown) => error,
  )
  request.commitResponseCookies()
  return { response: request.response, result }
}

export function expectSessionKept(
  harness: HandlerHarness,
  persistentSession: Record<string, unknown>,
) {
  expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual({
    ...seededUserSession,
    expireAt: persistentSession['exp'],
  })
  expect(harness.inspectStorage('oidc').get(sessionId)).toStrictEqual(persistentSession)
}

export function expectSessionCleared(harness: HandlerHarness) {
  expect(harness.inspectSession('nuxt-oidc-auth')?.data ?? {}).toStrictEqual({})
  expect(harness.inspectStorage('oidc').has(sessionId)).toBe(false)
}

export async function invokeRefreshEndpoint(harness: HandlerHarness) {
  const handler = (await import('../../src/runtime/server/api/refresh.post')).default
  const request = harness.createEvent({ method: 'POST', path: '/api/_auth/refresh' })
  const result: unknown = await handler(request.event).catch((error: unknown) => error)
  request.commitResponseCookies()
  return result
}

export function inSeconds(seconds: number) {
  return Math.trunc(Date.now() / 1000) + seconds
}

export async function getSession(harness: HandlerHarness) {
  const request = harness.createEvent({ path: '/api/orders' })
  const { getUserSession } = await import('../../src/runtime/server/utils/session')
  const result: unknown = await getUserSession(request.event).catch((error: unknown) => error)
  request.commitResponseCookies()
  return result
}
