import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'

import type { H3Event } from 'h3'
import { createEvent, isError } from 'h3'
import { decodeJwt } from 'jose'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { UserSession } from '../../src/runtime/types'
import { startFaultOidcProvider } from '../setup/fault-oidc-provider'

const SESSION_NAME = 'nuxt-oidc-auth'
const REDIRECT_URI = 'https://app.example.test/auth/oidc/callback'
const AUTHORIZATION_CODE = /name="code" value="([^"]+)"/u
const MAX_AGE_ZERO = /;\s*Max-Age=0(?:;|$)/iu

type StorageOperation = 'removeItem' | 'setItem'
type StorageFault = (operation: StorageOperation, key: string) => 'after' | 'before' | undefined

const records = new Map<string, unknown>()
let storageFault: StorageFault | undefined
const providers: Record<string, unknown> = {}
const runtimeConfig = {
  oidc: {
    session: {
      maxAge: 3600,
      automaticRefresh: false,
      expirationCheck: false,
      missingPersistentSession: 'clear',
    },
    providers,
  },
}

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt generates #imports only inside an application build.
vi.mock('#imports', () => ({ useRuntimeConfig: () => runtimeConfig }))

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nitro storage depends on generated virtual modules; this memory driver fails on demand like an unavailable storage backend.
vi.mock('nitropack/runtime', () => ({
  useStorage: () => {
    return {
      getItem: async (key: string) => structuredClone(records.get(key)) ?? null,
      setItem: async (key: string, value: unknown) => {
        await writeRecord('setItem', key, () => {
          records.set(key, structuredClone(value))
        })
      },
      removeItem: async (key: string) => {
        await writeRecord('removeItem', key, () => {
          records.delete(key)
        })
      },
    }
  },
}))

async function writeRecord(operation: StorageOperation, key: string, apply: () => void) {
  const fault = storageFault?.(operation, key)
  if (fault === 'before') {
    throw new Error('Storage unavailable')
  }
  apply()
  if (fault === 'after') {
    throw new Error('Storage unavailable')
  }
}

async function settle(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
    return null
  } catch (error) {
    return error
  }
}

/** A browser cookie store that sends and receives the real sealed h3 session cookies. */
class Browser {
  readonly cookies = new Map<string, string>()

  request(path: string, cookies: ReadonlyMap<string, string> = this.cookies): H3Event {
    const request = new IncomingMessage(new Socket())
    request.headers = {
      host: 'app.example.test',
      cookie: Array.from(cookies, ([name, value]) => `${name}=${value}`).join('; '),
    }
    request.method = 'GET'
    request.url = path
    return createEvent(request, new ServerResponse(request))
  }

  receive(event: H3Event): void {
    for (const cookie of setCookies(event)) {
      const attributes = cookie.indexOf(';')
      const nameAndValue = attributes === -1 ? cookie : cookie.slice(0, attributes)
      const separator = nameAndValue.indexOf('=')
      const name = nameAndValue.slice(0, separator)
      const value = nameAndValue.slice(separator + 1)
      if (value === '' || MAX_AGE_ZERO.test(cookie)) {
        this.cookies.delete(name)
      } else {
        this.cookies.set(name, value)
      }
    }
  }
}

function setCookies(event: H3Event): string[] {
  const header = event.node.res.getHeader('set-cookie')
  if (header === undefined) {
    return []
  }
  return Array.isArray(header) ? header : [String(header)]
}

function sessionCookie(browser: Browser): ReadonlyMap<string, string> {
  const value = browser.cookies.get(SESSION_NAME)
  if (value === undefined) {
    throw new Error('Browser has no user session cookie')
  }
  return new Map([[SESSION_NAME, value]])
}

let provider: Awaited<ReturnType<typeof startFaultOidcProvider>>
let defaultProviderConfig: Record<string, unknown> = {}

beforeAll(async () => {
  provider = await startFaultOidcProvider(REDIRECT_URI, 'https://app.example.test/')
  defaultProviderConfig = {
    clientId: 'browser-client',
    clientSecret: 'browser-secret',
    authorizationUrl: `${provider.origin}/authorize`,
    tokenUrl: `${provider.origin}/token`,
    userInfoUrl: `${provider.origin}/userinfo`,
    redirectUri: REDIRECT_URI,
    nonce: true,
    validateAccessToken: false,
    validateIdToken: false,
    requiredProperties: ['clientId', 'clientSecret', 'authorizationUrl', 'tokenUrl', 'redirectUri'],
  }
  providers['oidc'] = defaultProviderConfig
})

beforeEach(() => {
  provider.reset()
  vi.stubEnv('NUXT_OIDC_AUTH_SESSION_SECRET', 'test-auth-session-secret-at-least-32-characters')
  vi.stubEnv('NUXT_OIDC_SESSION_SECRET', 'test-session-secret-at-least-32-characters')
  vi.stubEnv('NUXT_OIDC_TOKEN_KEY', 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=')
})

afterEach(() => {
  records.clear()
  storageFault = undefined
  providers['oidc'] = defaultProviderConfig
  vi.unstubAllEnvs()
})

afterAll(async () => {
  await provider.close()
})

async function login(event: H3Event): Promise<void> {
  const loginHandler = (await import('../../src/runtime/server/handler/login.get')).default
  await loginHandler(event)
}

/** Start a login and let the provider authorize it, returning the callback query. */
async function authorize(browser: Browser): Promise<URLSearchParams> {
  const event = browser.request('/auth/oidc/login')
  await login(event)
  browser.receive(event)
  const authorizationUrl = String(event.node.res.getHeader('location'))
  const authorizationPage = await (await fetch(authorizationUrl)).text()
  return new URLSearchParams({
    code: AUTHORIZATION_CODE.exec(authorizationPage)?.[1] ?? '',
    state: new URL(authorizationUrl).searchParams.get('state') ?? '',
  })
}

async function startSignIn(browser: Browser): Promise<H3Event> {
  return browser.request(`/auth/oidc/callback?${(await authorize(browser)).toString()}`)
}

async function callback(event: H3Event): Promise<void> {
  const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
  await callbackHandler(event)
}

async function signIn(browser: Browser): Promise<void> {
  const event = await startSignIn(browser)
  await callback(event)
  browser.receive(event)
}

async function session() {
  return await import('../../src/runtime/server/utils/session')
}

async function sessionId(cookies: ReadonlyMap<string, string>, browser: Browser): Promise<string> {
  return await (await session()).getUserSessionId(browser.request('/api/session-id', cookies))
}

async function accessTokenSubject(browser: Browser, cookies: ReadonlyMap<string, string>) {
  const accessToken = await (
    await session()
  ).getAccessToken(browser.request('/api/orders', cookies))
  return decodeJwt(accessToken).sub
}

/** The access-token subject of a session, or the HTTP status that rejected it. */
async function accessOutcome(browser: Browser, cookies: ReadonlyMap<string, string>) {
  try {
    return await accessTokenSubject(browser, cookies)
  } catch (error) {
    return isError(error) ? error.statusCode : error
  }
}

describe('session rotation with sealed browser cookies', () => {
  it('keeps a replayed earlier cookie away from the next account', async () => {
    const browser = new Browser()
    const { getPersistedIdToken, getUserSession, refreshUserSession, setUserSession } =
      await session()
    await signIn(browser)
    const preferences = browser.request('/api/preferences')
    const signedInSession: UserSession & { applicationData: { theme: string } } = {
      ...(await getUserSession(preferences)),
      applicationData: { theme: 'dark' },
    }
    await setUserSession(preferences, signedInSession)
    browser.receive(preferences)
    const refresh = browser.request('/api/_auth/refresh')
    await refreshUserSession(refresh)
    browser.receive(refresh)
    const cookieA = sessionCookie(browser)
    const idA = await sessionId(cookieA, browser)
    await expect(accessTokenSubject(browser, cookieA)).resolves.toBe('first-user')

    await signIn(browser)
    const cookieB = sessionCookie(browser)
    const idB = await sessionId(cookieB, browser)

    expect(idB).not.toBe(idA)
    expect([...records.keys()]).toStrictEqual([idB])
    const recordB = structuredClone(records.get(idB))
    const tokenRequests = provider.getTokenRequestCount()
    await expect(getUserSession(browser.request('/', cookieA))).rejects.toMatchObject({
      statusCode: 401,
    })
    await expect(accessTokenSubject(browser, cookieA)).rejects.toMatchObject({ statusCode: 401 })
    await expect(
      getPersistedIdToken(browser.request('/auth/oidc/logout', cookieA)),
    ).resolves.toBeUndefined()
    await expect(
      refreshUserSession(browser.request('/api/_auth/refresh', cookieA)),
    ).rejects.toMatchObject({ statusCode: 401 })

    expect(provider.getTokenRequestCount()).toBe(tokenRequests)
    expect([...records.keys()]).toStrictEqual([idB])
    expect(records.get(idB)).toStrictEqual(recordB)
    await expect(accessTokenSubject(browser, cookieB)).resolves.toBe('second-user')
    const sessionB = await getUserSession(browser.request('/', cookieB))
    expect(sessionB).toMatchObject({ provider: 'oidc', applicationData: { theme: 'dark' } })
    expect(sessionB).not.toHaveProperty('userInfo')
  })

  it('does not restore the token record of a session replaced during its refresh', async () => {
    const browser = new Browser()
    const { refreshUserSession } = await session()
    await signIn(browser)
    const cookieA = sessionCookie(browser)
    const idA = await sessionId(cookieA, browser)
    const { releaseTokenRequest, tokenRequestReached } = provider.blockNextTokenRequest()
    const refreshA = settle(refreshUserSession(browser.request('/api/_auth/refresh', cookieA)))
    await tokenRequestReached

    await signIn(browser)
    const idB = await sessionId(sessionCookie(browser), browser)
    const recordB = structuredClone(records.get(idB))
    releaseTokenRequest()

    await expect(refreshA).resolves.toMatchObject({ statusCode: 401 })
    expect(records.has(idA)).toBe(false)
    expect([...records.keys()]).toStrictEqual([idB])
    expect(records.get(idB)).toStrictEqual(recordB)
    await expect(accessTokenSubject(browser, sessionCookie(browser))).resolves.toBe('second-user')
  })

  it.each(['before', 'after'] as const)(
    'keeps the established session when storing the new tokens fails %s the write',
    async (fault) => {
      const browser = new Browser()
      await signIn(browser)
      const cookieA = sessionCookie(browser)
      const idA = await sessionId(cookieA, browser)
      const recordA = structuredClone(records.get(idA))
      const event = await startSignIn(browser)
      storageFault = (operation, key) =>
        operation === 'setItem' && key !== idA ? fault : undefined

      await expect(callback(event)).rejects.toThrow('Storage unavailable')
      browser.receive(event)

      expect(browser.cookies.get(SESSION_NAME)).toBe(cookieA.get(SESSION_NAME))
      expect([...records.keys()]).toStrictEqual([idA])
      expect(records.get(idA)).toStrictEqual(recordA)
      storageFault = undefined
      await expect(accessTokenSubject(browser, cookieA)).resolves.toBe('first-user')
    },
  )

  it.each([
    { fault: 'before', previousRecordKept: true, previousAccess: 'first-user' },
    { fault: 'after', previousRecordKept: false, previousAccess: 401 },
  ] as const)(
    'fails the login when removing the previous token record fails $fault the removal',
    async ({ fault, previousRecordKept, previousAccess }) => {
      const browser = new Browser()
      await signIn(browser)
      const cookieA = sessionCookie(browser)
      const idA = await sessionId(cookieA, browser)
      const event = await startSignIn(browser)
      storageFault = (operation, key) =>
        operation === 'removeItem' && key === idA ? fault : undefined

      await expect(callback(event)).rejects.toThrow('Storage unavailable')
      browser.receive(event)

      expect(browser.cookies.get(SESSION_NAME)).toBe(cookieA.get(SESSION_NAME))
      expect([...records.keys()]).toStrictEqual(previousRecordKept ? [idA] : [])
      storageFault = undefined
      await expect(accessOutcome(browser, cookieA)).resolves.toBe(previousAccess)
    },
  )
})

interface FailedLogin {
  name: string
  error: string
  /** Prepares the browser and provider and returns the request that fails */
  prepare: (
    browser: Browser,
  ) => Promise<{ path: string; handle: (event: H3Event) => Promise<void> }>
}

function configureProvider(overrides: Record<string, unknown> = {}): void {
  providers['oidc'] = {
    ...defaultProviderConfig,
    sessionConfiguration: { singleSignOut: true, singleSignOutIdField: 'sub' },
    ...overrides,
  }
}

/** Seal an auth transaction into the browser like the login handler does. */
async function sealAuthTransaction(browser: Browser, data: Record<string, string>): Promise<void> {
  const event = browser.request('/auth/oidc/login')
  await (await (await session()).useAuthSession(event)).update(data)
  browser.receive(event)
}

const failedLogins: FailedLogin[] = [
  {
    name: 'a state mismatch',
    error: 'State mismatch',
    prepare: async (browser) => {
      const query = await authorize(browser)
      query.set('state', 'forged-state')
      return { path: `/auth/oidc/callback?${query.toString()}`, handle: callback }
    },
  },
  {
    name: 'a missing PKCE verifier',
    error: 'Callback failed, missing auth transaction',
    prepare: async (browser) => {
      await sealAuthTransaction(browser, { state: 'forged-state' })
      return { path: '/auth/oidc/callback?code=forged-code&state=forged-state', handle: callback }
    },
  },
  {
    name: 'a token endpoint error',
    error: 'Token request failed',
    prepare: async (browser) => {
      // The provider reads URL-encoded token requests and rejects a verifier that does not match
      // the code's challenge
      configureProvider({ tokenRequestType: 'form-urlencoded' })
      const code = (await authorize(browser)).get('code') ?? ''
      await sealAuthTransaction(browser, { state: 'other-state', codeVerifier: 'other-verifier' })
      return { path: `/auth/oidc/callback?code=${code}&state=other-state`, handle: callback }
    },
  },
  {
    name: 'a token validation failure',
    error: 'Token validation failed',
    prepare: async (browser) => {
      configureProvider({
        openIdConfiguration: `${provider.origin}/.well-known/openid-configuration`,
        validateIdToken: true,
      })
      provider.setTokenFault('invalid-signature')
      return {
        path: `/auth/oidc/callback?${(await authorize(browser)).toString()}`,
        handle: callback,
      }
    },
  },
  {
    name: 'a provider discovery failure at login',
    error: 'Provider discovery failed',
    prepare: async (browser) => {
      await authorize(browser)
      configureProvider({
        authorizationUrl: undefined,
        openIdConfiguration: `${provider.origin}/missing-discovery`,
      })
      return { path: '/auth/oidc/login', handle: login }
    },
  },
  {
    name: 'an invalid configuration at login',
    error: 'Invalid configuration',
    prepare: async (browser) => {
      await authorize(browser)
      configureProvider({ clientId: '' })
      return { path: '/auth/oidc/login', handle: login }
    },
  },
]

describe('failed logins with sealed browser cookies', () => {
  const errorOutput: string[] = []
  const sessionEnds: string[] = []
  let removeHooks: (() => void)[] = []

  beforeEach(async () => {
    configureProvider()
    errorOutput.length = 0
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      errorOutput.push(String(chunk))
      return true
    })
    const { logoutHooks, sessionHooks } = await session()
    sessionEnds.length = 0
    removeHooks = [
      logoutHooks.hook('first-user', () => {
        sessionEnds.push('logout')
      }),
      sessionHooks.hook('clear', () => {
        sessionEnds.push('clear')
      }),
    ]
  })

  afterEach(() => {
    for (const removeHook of removeHooks) {
      removeHook()
    }
    vi.restoreAllMocks()
  })

  it.each(failedLogins)('keeps the established session after $name', async ({ error, prepare }) => {
    const browser = new Browser()
    await signIn(browser)
    const cookie = sessionCookie(browser)
    const id = await sessionId(cookie, browser)
    const [generationKey, ...otherGenerations] = [...records.keys()].filter((key) =>
      key.startsWith('sso-generation:oidc:'),
    )
    expect(otherGenerations).toStrictEqual([])
    const generation = records.get(String(generationKey))
    expect(typeof generation).toBe('string')
    expect(records.get(id)).toHaveProperty('refreshToken')
    expect(records.get(id)).toMatchObject({
      singleSignOutId: 'first-user',
      singleSignOutGeneration: generation,
    })
    const establishedRecords = structuredClone(records)
    const { path, handle } = await prepare(browser)
    expect(browser.cookies.has('oidc')).toBe(true)

    const event = browser.request(path)
    await handle(event)
    browser.receive(event)

    expect(event.node.res.statusCode).toBe(302)
    expect(event.node.res.getHeader('location')).toBe('/')
    expect(errorOutput.join('')).toContain(error)
    expect(browser.cookies.has('oidc')).toBe(false)
    expect(browser.cookies.get(SESSION_NAME)).toBe(cookie.get(SESSION_NAME))
    expect(records.get(String(generationKey))).toBe(generation)
    expect(records).toStrictEqual(establishedRecords)
    expect(sessionEnds).toStrictEqual([])
    await expect(
      (await session()).getUserSession(browser.request('/', cookie)),
    ).resolves.toMatchObject({ provider: 'oidc', canRefresh: true, singleSignOut: true })
    await expect(accessTokenSubject(browser, cookie)).resolves.toBe('first-user')
  })
})
