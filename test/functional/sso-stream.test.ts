import { createApp, createRouter, defineEventHandler, toWebHandler } from 'h3'
import { createStorage } from 'unstorage'
import { afterEach, expect, it, vi } from 'vitest'

import sso from '../../src/runtime/server/api/sso'
import logout from '../../src/runtime/server/handler/logout.get'
import { setUserSession } from '../../src/runtime/server/utils/session'

const storage = createStorage()
const runtimeConfig = { oidc: { providers: { oidc: {} }, session: { maxAge: 3600 } } }

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt generates #imports inside the application build.
vi.mock('#imports', () => ({ useRuntimeConfig: () => runtimeConfig }))

// oxlint-disable-next-line anti-slop/no-module-mocking -- Mount real in-memory storage without Nitro's generated runtime.
vi.mock('nitropack/runtime', () => ({ useStorage: () => storage }))

afterEach(async () => {
  vi.unstubAllEnvs()
  await storage.clear()
})

it('streams the logout event to another request for the signed-in session', async () => {
  vi.stubEnv('NUXT_OIDC_SESSION_SECRET', 'test-session-secret-at-least-32-characters')
  let closeStream: (() => void) | undefined
  const router = createRouter()
    .post(
      '/session',
      defineEventHandler(
        async (event) =>
          await setUserSession(event, {
            provider: 'oidc',
            canRefresh: false,
            expireAt: Math.trunc(Date.now() / 1000) + 3600,
            singleSignOut: true,
            tokensStored: false,
          }),
      ),
    )
    .get(
      '/api/_auth/sso',
      defineEventHandler(async (event) => {
        // The in-process web adapter has no socket to close after reading the event.
        closeStream = () => {
          event.node.req.emit('close')
        }
        await sso(event)
      }),
    )
    .get('/auth/oidc/logout', logout)
  const handle = toWebHandler(createApp().use(router))
  const signedIn = await handle(new Request('http://localhost/session', { method: 'POST' }))
  const setCookie = signedIn.headers
    .getSetCookie()
    .find((value) => value.startsWith('nuxt-oidc-auth='))
  if (setCookie === undefined) {
    throw new Error('Expected a signed session cookie')
  }
  const separator = setCookie.indexOf(';')
  const cookie = separator === -1 ? setCookie : setCookie.slice(0, separator)

  const stream = await handle(
    new Request('http://localhost/api/_auth/sso', { headers: { cookie } }),
  )
  const received = stream.text()
  try {
    expect(stream.status).toBe(200)
    expect(stream.headers.get('content-type')).toBe('text/event-stream')
    const loggedOut = await handle(
      new Request('http://localhost/auth/oidc/logout', { headers: { cookie } }),
    )
    expect(loggedOut.status).toBe(302)
  } finally {
    closeStream?.()
  }

  await expect(received).resolves.toBe('event: logout\ndata: \n\n')
})
