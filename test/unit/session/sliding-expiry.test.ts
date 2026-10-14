import { once } from 'node:events'
import { createServer } from 'node:http'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { uint8ArrayToBase64 } from '../../../src/runtime/server/utils/encoding'
import { encryptToken } from '../../../src/runtime/server/utils/security'
import { refreshUserSession } from '../../../src/runtime/server/utils/session'
import type { PersistentSession } from '../../../src/runtime/types'
import { createRequestEvent } from '../request-event'

const SESSION_NAME = 'nuxt-oidc-auth'
const SESSION_MAX_AGE = 1800
const COOKIE_EXPIRES = /(?:^|;\s*)Expires=([^;]+)/iu
const persistentSessions = new Map<string, PersistentSession>()
const runtimeConfig = {
  oidc: {
    session: { maxAge: SESSION_MAX_AGE },
    providers: {
      oidc: {
        clientId: 'test',
        clientSecret: 'secret',
        authorizationUrl: 'https://issuer.example.test/authorize',
        redirectUri: 'https://app.example.test/auth/oidc/callback',
        tokenUrl: '',
        skipAccessTokenParsing: true,
        validateAccessToken: false,
        validateIdToken: false,
        exposeAccessToken: '__NUXT_OIDC_RUNTIME_CONFIG_UNSET__',
        exposeIdToken: '__NUXT_OIDC_RUNTIME_CONFIG_UNSET__',
      },
    },
  },
}

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt's virtual imports are unavailable outside its runtime.
vi.mock('#imports', () => ({ useRuntimeConfig: () => runtimeConfig }))

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nitro storage requires its generated runtime; the memory store preserves actual encrypted session data.
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

afterEach(() => {
  vi.unstubAllEnvs()
  persistentSessions.clear()
})

describe('sliding session expiry', () => {
  it('moves cookie expiry forward after a real token refresh without exposing tokens', async () => {
    const requestBodies: string[] = []
    const server = createServer((request, response) => {
      request.setEncoding('utf8')
      let body = ''
      request.on('data', (chunk: string) => {
        body += chunk
      })
      request.on('end', () => {
        requestBodies.push(body)
        response.setHeader('content-type', 'application/json')
        response.end(
          JSON.stringify({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: '3600',
            token_type: 'Bearer',
          }),
        )
      })
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')

    try {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        throw new Error('Token endpoint did not bind a TCP port')
      }
      runtimeConfig.oidc.providers.oidc.tokenUrl = `http://127.0.0.1:${address.port}/token`
      const tokenKey = uint8ArrayToBase64(crypto.getRandomValues(new Uint8Array(32)))
      vi.stubEnv('NUXT_OIDC_TOKEN_KEY', tokenKey)
      vi.stubEnv('NUXT_OIDC_SESSION_SECRET', 'test-session-secret-at-least-32-characters')
      const originalCreatedAt = Date.now() - 3600_000
      const event = createRequestEvent()
      event.context.sessions = {
        [SESSION_NAME]: {
          id: 'test-session-id',
          createdAt: originalCreatedAt,
          data: {
            provider: 'oidc',
            canRefresh: true,
            loggedInAt: Math.trunc(originalCreatedAt / 1000),
            expireAt: Math.trunc(Date.now() / 1000) + 1800,
          },
        },
      }
      persistentSessions.set('test-session-id', {
        createdAt: new Date(originalCreatedAt),
        updatedAt: new Date(originalCreatedAt),
        exp: Math.trunc(Date.now() / 1000) + 1800,
        iat: Math.trunc(originalCreatedAt / 1000),
        accessToken: await encryptToken('old-access-token', tokenKey),
        refreshToken: await encryptToken('old-refresh-token', tokenKey),
      })

      const beforeRefresh = Math.trunc(Date.now() / 1000) * 1000
      const refreshedSession = await refreshUserSession(event)
      const afterRefresh = Math.trunc(Date.now() / 1000) * 1000

      const setCookies = event.node.res.getHeader('set-cookie')
      const cookies = Array.isArray(setCookies) ? setCookies : [setCookies]
      const sessionCookie = cookies.find(
        (cookie): cookie is string =>
          typeof cookie === 'string' && cookie.startsWith(`${SESSION_NAME}=`),
      )
      const expires =
        sessionCookie === undefined ? undefined : COOKIE_EXPIRES.exec(sessionCookie)?.[1]
      if (expires === undefined) {
        throw new Error('Refreshed session did not emit a cookie expiry')
      }
      expect(Date.parse(expires)).toBeGreaterThanOrEqual(beforeRefresh + SESSION_MAX_AGE * 1000)
      expect(Date.parse(expires)).toBeLessThanOrEqual(afterRefresh + SESSION_MAX_AGE * 1000)
      expect(requestBodies).toHaveLength(1)
      expect(requestBodies[0]).toContain('old-refresh-token')
      expect(refreshedSession).not.toHaveProperty('accessToken')
      expect(refreshedSession).not.toHaveProperty('idToken')
    } finally {
      server.close()
      await once(server, 'close')
    }
  })
})
