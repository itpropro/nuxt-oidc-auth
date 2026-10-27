import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { H3Event } from 'h3'
import type { Driver, Storage } from 'unstorage'
import { createStorage } from 'unstorage'
import fsLiteDriver from 'unstorage/drivers/fs-lite'
import memoryDriver from 'unstorage/drivers/memory'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { HandlerResponse } from './handler-harness'
import { createRs256Fixture, HandlerHarness, interceptFetch } from './handler-harness'

const clientId = 'functional-client'
const issuer = 'https://identity.example.test'
const keycloakBaseUrl = 'https://keycloak.example.test/realms/app'
const sessionCookie = 'nuxt-oidc-auth'
const nonce = 'functional-nonce'
const requiredProperties = ['clientId', 'clientSecret', 'authorizationUrl', 'tokenUrl']
const TOKEN_ENDPOINT_RE = /\/token$/u
const USERINFO_ENDPOINT_RE = /\/userinfo$/u

const runtimeConfig = {
  oidc: {
    session: { automaticRefresh: true, expirationCheck: true, maxAge: 3600 },
    providers: {
      oidc: {
        authorizationUrl: `${issuer}/authorize`,
        clientId,
        clientSecret: 'functional-secret',
        redirectUri: 'https://app.example.test/auth/oidc/callback',
        requiredProperties,
        sessionConfiguration: { singleSignOut: true, singleSignOutIdField: 'sub' },
        skipAccessTokenParsing: true,
        tokenRequestType: 'form-urlencoded',
        tokenUrl: `${issuer}/token`,
        validateAccessToken: false,
        validateIdToken: false,
      },
      keycloak: {
        baseUrl: keycloakBaseUrl,
        clientId,
        clientSecret: 'functional-secret',
        redirectUri: 'https://app.example.test/auth/keycloak/callback',
        sessionConfiguration: { singleSignOut: true, singleSignOutIdField: 'sub' },
        skipAccessTokenParsing: true,
        validateAccessToken: false,
        validateIdToken: false,
      },
    },
  },
}

type Provider = keyof typeof runtimeConfig.oidc.providers

interface Browser {
  provider: Provider
  session?: string
}

interface StorageFaults {
  beforeWrite?: (key: string) => Promise<void>
  failRead?: (key: string) => boolean
}

let signingFixture: Awaited<ReturnType<typeof createRs256Fixture>>
let refreshGate: Promise<undefined> | undefined
let refreshRequests: number

beforeAll(async () => {
  signingFixture = await createRs256Fixture()
})

beforeEach(() => {
  vi.stubEnv('NUXT_OIDC_TOKEN_KEY', 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=')
  vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  refreshGate = undefined
  refreshRequests = 0
  interceptFetch([
    { method: 'POST', url: TOKEN_ENDPOINT_RE, respond: answerTokenRequest },
    { method: 'GET', url: USERINFO_ENDPOINT_RE, respond: () => Response.json({}) },
  ])
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function answerTokenRequest(request: Request): Promise<Response> {
  const body = new URLSearchParams(await request.text())
  if (body.get('grant_type') === 'refresh_token') {
    refreshRequests += 1
    await refreshGate
    return Response.json({
      access_token: 'refreshed-access-token',
      expires_in: '3600',
      refresh_token: 'rotated-refresh-token',
      token_type: 'Bearer',
    })
  }
  const subject = body.get('code')
  return Response.json({
    access_token: `access-token-${subject}`,
    expires_in: '3600',
    id_token: await signingFixture.sign({ aud: clientId, iss: issuer, nonce, sub: subject }),
    refresh_token: `refresh-token-${subject}`,
    token_type: 'Bearer',
  })
}

function memoryStorage(faults: StorageFaults = {}): Storage {
  const driver: Driver = memoryDriver()
  return createStorage({
    driver: {
      ...driver,
      getItem: async (key, options) => {
        if (faults.failRead?.(key) === true) {
          throw new Error('Storage unavailable')
        }
        return await driver.getItem(key, options)
      },
      setItem: async (key, value, options) => {
        await faults.beforeWrite?.(key)
        await driver.setItem?.(key, value, options)
      },
    },
  })
}

/** Each server loads its own module instance, so no in-process state or hook is shared. */
async function startServer(storage: Storage, config: Record<string, unknown> = runtimeConfig) {
  const harness = new HandlerHarness({ runtimeConfig: config, storage })
  vi.resetModules()
  return {
    harness,
    callback: (await import('../../src/runtime/server/handler/callback')).default,
    logout: (await import('../../src/runtime/server/handler/logout.get')).default,
    session: (await import('../../src/runtime/server/api/session.get')).default,
    sso: (await import('../../src/runtime/server/api/sso')).default,
    utils: await import('../../src/runtime/server/utils/session'),
  }
}

type Server = Awaited<ReturnType<typeof startServer>>

function useBrowserCookie(server: Server, browser: Browser): void {
  if (browser.session === undefined) {
    server.harness.cookieJar.delete(sessionCookie)
  } else {
    server.harness.cookieJar.set(sessionCookie, browser.session)
  }
}

async function send(
  server: Server,
  browser: Browser,
  path: string,
  handle: (event: H3Event) => Promise<unknown>,
  headers?: Record<string, string>,
): Promise<{ response: HandlerResponse; result: unknown }> {
  server.harness.activate()
  useBrowserCookie(server, browser)
  const request = server.harness.createEvent({ path, headers })
  const result = await handle(request.event).catch((error: unknown) => error)
  useBrowserCookie(server, browser)
  request.commitResponseCookies()
  browser.session = server.harness.cookieJar.get(sessionCookie)
  return { response: request.response, result }
}

async function signIn(
  server: Server,
  provider: Provider,
  subject: string,
  existingBrowser?: Browser,
): Promise<Browser> {
  const browser: Browser = existingBrowser ?? { provider }
  const previousSession = browser.session
  server.harness.cookieJar.seedSession('__Host-oidc', {
    codeVerifier: 'functional-code-verifier',
    nonce,
    redirect: `https://app.example.test/auth/${provider}/callback`,
    state: 'functional-state',
  })
  server.harness.activate()
  useBrowserCookie(server, browser)
  const request = server.harness.createEvent({
    path: `/auth/${provider}/callback`,
    query: { code: subject, state: 'functional-state' },
  })
  await server.callback(request.event)
  request.commitResponseCookies()
  browser.session = server.harness.cookieJar.get(sessionCookie)
  expect(request.response.status).toBe(302)
  expect(browser.session).toBeDefined()
  expect(browser.session).not.toBe(previousSession)
  return browser
}

async function fetchSession(server: Server, browser: Browser): Promise<unknown> {
  const { result } = await send(server, browser, '/api/_auth/session', server.session)
  return result
}

async function refresh(server: Server, browser: Browser): Promise<unknown> {
  const { result } = await send(
    server,
    browser,
    '/api/_auth/refresh',
    server.utils.refreshUserSession,
  )
  return result
}

async function logout(server: Server, browser: Browser): Promise<void> {
  const { response } = await send(
    server,
    browser,
    `/auth/${browser.provider}/logout`,
    server.logout,
  )
  expect(response.status).toBe(302)
  expect(browser.session).toBeUndefined()
}

async function persistentSessionOf(server: Server, sessionId: string | undefined) {
  server.harness.activate()
  return await server.harness.storage('oidc').getItem(String(sessionId))
}

function failGenerationWrites(failing: () => boolean): StorageFaults {
  return {
    beforeWrite: async (key) => {
      if (failing() && key.startsWith('oidc:sso-generation:')) {
        throw new Error('Storage unavailable')
      }
    },
  }
}

function signedIn(provider: Provider) {
  return { canRefresh: true, provider, singleSignOut: true }
}

async function storedEntries(storage: Storage): Promise<Record<string, unknown>> {
  const keys = await storage.getKeys()
  return Object.fromEntries(
    await Promise.all(keys.map(async (key) => [key, await storage.getItem(key)] as const)),
  )
}

describe('durable single sign-out', () => {
  it('revokes every persistent session of the identity without an open event stream', async () => {
    const server = await startServer(memoryStorage())
    const laptop = await signIn(server, 'oidc', 'user-1')
    const phone = await signIn(server, 'oidc', 'user-1')
    const tablet = await signIn(server, 'oidc', 'user-1')
    const colleague = await signIn(server, 'oidc', 'user-2')
    const otherProvider = await signIn(server, 'keycloak', 'user-1')
    const phoneSessionId = phone.session
    await expect(fetchSession(server, phone)).resolves.toMatchObject(signedIn('oidc'))

    await logout(server, laptop)

    await expect(refresh(server, phone)).resolves.toMatchObject({ statusCode: 401 })
    expect(refreshRequests).toBe(0)
    expect(phone.session).toBeUndefined()
    await expect(persistentSessionOf(server, phoneSessionId)).resolves.toBeNull()
    await expect(fetchSession(server, tablet)).resolves.toStrictEqual({})
    expect(tablet.session).toBeUndefined()
    await expect(fetchSession(server, colleague)).resolves.toMatchObject(signedIn('oidc'))
    await expect(fetchSession(server, otherProvider)).resolves.toMatchObject(signedIn('keycloak'))
  })

  it('notifies event streams only for the provider of the signed-out identity', async () => {
    const server = await startServer(memoryStorage())
    const laptop = await signIn(server, 'oidc', 'user-1')
    const phone = await signIn(server, 'oidc', 'user-1')
    const otherProvider = await signIn(server, 'keycloak', 'user-1')
    const phoneStream = await send(server, phone, '/api/_auth/sso', server.sso)
    const otherProviderStream = await send(server, otherProvider, '/api/_auth/sso', server.sso)

    await logout(server, laptop)

    expect(phoneStream.response.eventStream?.messages).toStrictEqual([
      { event: 'logout', data: '' },
    ])
    expect(otherProviderStream.response.eventStream?.messages).toStrictEqual([])
    await expect(fetchSession(server, otherProvider)).resolves.toMatchObject(signedIn('keycloak'))
    await phoneStream.response.eventStream?.close()
    await otherProviderStream.response.eventStream?.close()
  })

  it('rejects revoked sessions without expiration checks and for server-side tokens', async () => {
    const config = structuredClone(runtimeConfig)
    Object.assign(config.oidc.providers.oidc.sessionConfiguration, { expirationCheck: false })
    const server = await startServer(memoryStorage(), config)
    const laptop = await signIn(server, 'oidc', 'user-1')
    const phone = await signIn(server, 'oidc', 'user-1')
    const tablet = await signIn(server, 'oidc', 'user-1')
    await expect(
      send(server, tablet, '/api/downstream', server.utils.getAccessToken),
    ).resolves.toMatchObject({ result: 'access-token-user-1' })

    await logout(server, laptop)

    await expect(fetchSession(server, phone)).resolves.toStrictEqual({})
    await expect(
      send(server, tablet, '/api/downstream', server.utils.getAccessToken),
    ).resolves.toMatchObject({ result: { statusCode: 401 } })
  })

  it('fails a login whose revocation generation cannot be stored', async () => {
    const storage = memoryStorage(failGenerationWrites(() => true))
    const server = await startServer(storage)

    await expect(signIn(server, 'oidc', 'user-1')).rejects.toThrow('Storage unavailable')

    await expect(storage.getKeys()).resolves.toStrictEqual([])
  })

  it('keeps the session signed in when its logout cannot revoke the identity', async () => {
    let failing = false
    const server = await startServer(memoryStorage(failGenerationWrites(() => failing)))
    const laptop = await signIn(server, 'oidc', 'user-1')
    const phone = await signIn(server, 'oidc', 'user-1')
    failing = true

    const { result } = await send(server, laptop, '/auth/oidc/logout', server.logout)

    expect(result).toBeInstanceOf(Error)
    await expect(fetchSession(server, laptop)).resolves.toMatchObject(signedIn('oidc'))
    await expect(fetchSession(server, phone)).resolves.toMatchObject(signedIn('oidc'))
    failing = false
    await logout(server, laptop)
    await expect(fetchSession(server, phone)).resolves.toStrictEqual({})
  })

  it('rejects a refresh that was waiting for the provider when the identity signed out', async () => {
    const server = await startServer(memoryStorage())
    const laptop = await signIn(server, 'oidc', 'user-1')
    const phone = await signIn(server, 'oidc', 'user-1')
    const phoneSessionId = phone.session
    const providerAnswer = Promise.withResolvers<undefined>()
    refreshGate = providerAnswer.promise

    const pendingRefresh = refresh(server, phone)
    await vi.waitFor(() => {
      expect(refreshRequests).toBe(1)
    })
    await logout(server, laptop)
    providerAnswer.resolve(undefined)

    await expect(pendingRefresh).resolves.toMatchObject({ statusCode: 401 })
    expect(phone.session).toBeUndefined()
    await expect(persistentSessionOf(server, phoneSessionId)).resolves.toBeNull()
  })

  it('rejects a refreshed session whose write landed after the identity signed out', async () => {
    let signOutBeforeWrite: ((key: string) => Promise<void>) | undefined
    const server = await startServer(
      memoryStorage({ beforeWrite: async (key) => await signOutBeforeWrite?.(key) }),
    )
    const laptop = await signIn(server, 'oidc', 'user-1')
    const phone = await signIn(server, 'oidc', 'user-1')
    signOutBeforeWrite = async (key) => {
      if (key === `oidc:${phone.session}`) {
        signOutBeforeWrite = undefined
        await logout(server, laptop)
      }
    }

    await expect(refresh(server, phone)).resolves.toMatchObject(signedIn('oidc'))
    expect(signOutBeforeWrite).toBeUndefined()

    await expect(fetchSession(server, phone)).resolves.toStrictEqual({})
  })

  it('keeps the identity signed in when one of its browsers signs in again', async () => {
    const server = await startServer(memoryStorage())
    const laptop = await signIn(server, 'oidc', 'user-1')
    const phone = await signIn(server, 'oidc', 'user-1')

    await signIn(server, 'oidc', 'user-1', laptop)

    await expect(fetchSession(server, laptop)).resolves.toMatchObject(signedIn('oidc'))
    await expect(fetchSession(server, phone)).resolves.toMatchObject(signedIn('oidc'))
  })

  it('accepts a new sign-in of the identity after its sessions were revoked', async () => {
    const server = await startServer(memoryStorage())
    const laptop = await signIn(server, 'oidc', 'user-1')
    await logout(server, laptop)

    const renewed = await signIn(server, 'oidc', 'user-1')

    await expect(fetchSession(server, renewed)).resolves.toMatchObject(signedIn('oidc'))
    await expect(refresh(server, renewed)).resolves.toMatchObject(signedIn('oidc'))
    await expect(fetchSession(server, renewed)).resolves.toMatchObject(signedIn('oidc'))
  })

  it('revokes sessions across servers that share the storage', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nuxt-oidc-auth-sso-'))
    try {
      const first = await startServer(createStorage({ driver: fsLiteDriver({ base: directory }) }))
      const second = await startServer(createStorage({ driver: fsLiteDriver({ base: directory }) }))
      const laptop = await signIn(first, 'oidc', 'user-1')
      const phone = await signIn(second, 'oidc', 'user-1')
      const stream = await send(second, phone, '/api/_auth/sso', second.sso)

      await logout(first, laptop)

      expect(stream.response.eventStream?.messages).toStrictEqual([])
      await expect(fetchSession(second, phone)).resolves.toStrictEqual({})
      await stream.response.eventStream?.close()

      const renewedPhone = await signIn(second, 'oidc', 'user-1')
      const renewedLaptop = await signIn(first, 'oidc', 'user-1')
      await expect(fetchSession(first, renewedLaptop)).resolves.toMatchObject(signedIn('oidc'))
      await logout(second, renewedPhone)
      await expect(fetchSession(first, renewedLaptop)).resolves.toStrictEqual({})
    } finally {
      await rm(directory, { force: true, recursive: true })
    }
  })

  it('rejects sessions while the shared revocation state cannot be read', async () => {
    let failRead: ((key: string) => boolean) | undefined
    const server = await startServer(memoryStorage({ failRead: (key) => failRead?.(key) === true }))
    const phone = await signIn(server, 'oidc', 'user-1')
    failRead = (key) => key !== `oidc:${phone.session}`

    await expect(fetchSession(server, phone)).resolves.toBeInstanceOf(Error)
    await expect(refresh(server, phone)).resolves.toBeInstanceOf(Error)
    expect(refreshRequests).toBe(0)

    failRead = undefined
    await expect(fetchSession(server, phone)).resolves.toMatchObject(signedIn('oidc'))
  })

  it('rejects sessions whose revocation state is missing', async () => {
    const storage = memoryStorage()
    const server = await startServer(storage)
    const phone = await signIn(server, 'oidc', 'user-1')
    const recordKey = `oidc:${phone.session}`
    const otherKeys = (await storage.getKeys()).filter((key) => key !== recordKey)
    await Promise.all(
      otherKeys.map(async (key) => {
        await storage.removeItem(key)
      }),
    )

    await expect(fetchSession(server, phone)).resolves.toStrictEqual({})
    await expect(storage.hasItem(recordKey)).resolves.toBe(false)
  })

  it('rejects persistent sessions stored without a revocation generation', async () => {
    const storage = memoryStorage()
    const server = await startServer(storage)
    const phone = await signIn(server, 'oidc', 'user-1')
    const recordKey = `oidc:${phone.session}`
    const record = await storage.getItem<Record<string, unknown>>(recordKey)
    await storage.setItem(recordKey, { ...record, singleSignOutGeneration: undefined })

    await expect(fetchSession(server, phone)).resolves.toStrictEqual({})
  })
})

describe('logout request origin', () => {
  it.each(['cross-site', 'same-site'])('ignores a %s logout', async (site) => {
    const storage = memoryStorage()
    const server = await startServer(storage)
    const laptop = await signIn(server, 'keycloak', 'user-1')
    const phone = await signIn(server, 'keycloak', 'user-1')
    const laptopSession = laptop.session
    const storedBefore = await storedEntries(storage)
    expect(storedBefore).toHaveProperty([`oidc:${laptopSession}`])
    expect(
      Object.keys(storedBefore).filter((key) => key.includes(':sso-generation:')),
    ).toHaveLength(1)

    const { response } = await send(server, laptop, '/auth/keycloak/logout', server.logout, {
      'sec-fetch-site': site,
    })

    expect(response).toMatchObject({ status: 302, location: 'https://app.example.test' })
    expect(laptop.session).toBe(laptopSession)
    await expect(storedEntries(storage)).resolves.toStrictEqual(storedBefore)
    await expect(fetchSession(server, laptop)).resolves.toMatchObject(signedIn('keycloak'))
    await expect(fetchSession(server, phone)).resolves.toMatchObject(signedIn('keycloak'))
  })

  it.each(['same-origin', 'none', undefined])(
    'signs out the identity for a logout with Sec-Fetch-Site %s',
    async (site) => {
      const server = await startServer(memoryStorage())
      const laptop = await signIn(server, 'keycloak', 'user-1')
      const phone = await signIn(server, 'keycloak', 'user-1')

      const { response } = await send(
        server,
        laptop,
        '/auth/keycloak/logout',
        server.logout,
        site === undefined ? {} : { 'sec-fetch-site': site },
      )

      expect(response.status).toBe(302)
      expect(response.location).toMatch(`${keycloakBaseUrl}/protocol/openid-connect/logout`)
      expect(laptop.session).toBeUndefined()
      await expect(fetchSession(server, phone)).resolves.toStrictEqual({})
    },
  )
})
