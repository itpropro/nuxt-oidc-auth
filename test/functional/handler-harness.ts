import type { AuthSession, UserSession } from '../../src/runtime/types'
import type { H3Event, SessionConfig } from 'h3'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { vi } from 'vitest'

type SessionData = AuthSession | UserSession | Record<string, unknown>

interface HarnessSession<T extends SessionData> {
  id: string
  readonly data: T
  clear: () => Promise<void>
  update: (data: Partial<T>) => Promise<{ data: T; id: string }>
}

interface StoredSession {
  id: string
  name: string
  maxAge?: number
  data: Record<string, unknown>
  clearCount: number
  updates: Record<string, unknown>[]
  operations: Array<'clear' | 'update'>
}

export interface SessionInspection {
  id: string
  name: string
  maxAge?: number
  data: Record<string, unknown>
  clearCount: number
  updates: Record<string, unknown>[]
  operations: Array<'clear' | 'update'>
}

export interface HandlerResponse {
  status: number
  headers: Record<string, string | string[]>
  location?: string
  eventStream?: {
    closed: boolean
    messages: Array<{ data: string; event?: string }>
    sent: boolean
    close: () => Promise<void>
  }
}

export interface FakeEventOptions {
  method?: string
  path: string
  query?: Record<string, string | string[] | undefined>
  body?: unknown
  cookies?: Record<string, string>
  headers?: Record<string, string>
  origin?: string
}

interface EventHarnessContext {
  body: unknown
  jar: CookieJar
  pendingCookies: Map<string, string | undefined>
  query: Record<string, string | string[] | undefined>
  requestCookies: ReadonlyMap<string, string>
  requestUrl: URL
  response: HandlerResponse
  sessions: Map<string, HarnessSession<SessionData>>
}

interface HarnessState {
  current?: HandlerHarness
}

const mockState = vi.hoisted<HarnessState>(() => ({}))

function activeHarness(): HandlerHarness {
  if (!mockState.current) throw new Error('Create a handler harness before invoking a handler')
  return mockState.current
}

function eventContext(event: H3Event): EventHarnessContext {
  const context = event.context.handlerHarness as EventHarnessContext | undefined
  if (!context) throw new Error('Event was not created by HandlerHarness')
  return context
}

function appendSetCookie(event: H3Event, value: string): void {
  const response = eventContext(event).response
  const existing = response.headers['set-cookie']
  response.headers['set-cookie'] = existing
    ? [...(Array.isArray(existing) ? existing : [existing]), value]
    : [value]
}

function queueCookie(event: H3Event, name: string, value: string | undefined): void {
  const context = eventContext(event)
  context.pendingCookies.set(name, value)
  appendSetCookie(
    event,
    value === undefined
      ? `${name}=; Max-Age=0; Path=/`
      : `${name}=${encodeURIComponent(value)}; Path=/`,
  )
}

vi.mock('#imports', () => ({
  useRuntimeConfig: () => activeHarness().runtimeConfig,
}))

vi.mock('nitropack/runtime', () => ({
  useStorage: (namespace: string) => activeHarness().storage(namespace),
}))

vi.mock('h3', async (importOriginal) => {
  // oxlint-disable-next-line typescript/consistent-type-imports -- Vitest importOriginal requires an inline module type
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    createEventStream: (event: H3Event) => {
      const response = eventContext(event).response
      const closeHandlers: Array<() => void | Promise<void>> = []
      const stream = {
        closed: false,
        messages: [] as Array<{ data: string; event?: string }>,
        sent: false,
        close: async () => {
          stream.closed = true
          await Promise.all(closeHandlers.map(async (handler) => await handler()))
        },
      }
      response.eventStream = stream
      return {
        onClosed: (handler: () => void | Promise<void>) => closeHandlers.push(handler),
        push: async (message: { data: string; event?: string }) => {
          stream.messages.push(message)
        },
        send: () => {
          stream.sent = true
          return undefined
        },
      }
    },
    deleteCookie: (event: H3Event, name: string) => {
      queueCookie(event, name, undefined)
    },
    getCookie: (event: H3Event, name: string) => eventContext(event).requestCookies.get(name),
    getQuery: (event: H3Event) => eventContext(event).query,
    getRequestHeader: (event: H3Event, name: string) => {
      const value = event.node.req.headers[name.toLowerCase()]
      return Array.isArray(value) ? value[0] : value
    },
    getRequestURL: (event: H3Event) => eventContext(event).requestUrl,
    readBody: (event: H3Event) => Promise.resolve(eventContext(event).body),
    sendRedirect: (event: H3Event, location: string, status: number = 302) => {
      const response = eventContext(event).response
      response.status = status
      response.location = location
      response.headers.location = location
      event.node.res.statusCode = status
      event.node.res.setHeader('location', location)
      return location
    },
    setResponseStatus: (event: H3Event, status: number) => {
      eventContext(event).response.status = status
      event.node.res.statusCode = status
    },
    setCookie: (event: H3Event, name: string, value: string) => {
      queueCookie(event, name, value)
    },
    useSession: <T extends SessionData>(event: H3Event, config: SessionConfig) =>
      Promise.resolve(eventContext(event).jar.useSession<T>(event, config)),
  }
})

function cloneData<T>(value: T): T {
  return structuredClone(value)
}

export class CookieJar {
  readonly #cookies = new Map<string, string>()
  readonly #sessions = new Map<string, StoredSession[]>()
  #nextSessionId = 0

  constructor(cookies: Record<string, string> = {}) {
    for (const [name, value] of Object.entries(cookies)) this.set(name, value)
  }

  delete(name: string): void {
    this.#cookies.delete(name)
  }

  get(name: string): string | undefined {
    return this.#cookies.get(name)
  }

  set(name: string, value: string): void {
    this.#cookies.set(name, value)
  }

  entries(): Record<string, string> {
    return Object.fromEntries(this.#cookies)
  }

  seedSession<T extends SessionData>(name: string, data: T, id?: string): SessionInspection {
    const session = this.#createSession(name, id)
    session.data = cloneData(data as Record<string, unknown>)
    this.#cookies.set(name, session.id)
    return this.#inspect(session)
  }

  inspectSession(name: string): SessionInspection | undefined {
    const sessions = this.#sessions.get(name)
    const session = sessions?.at(-1)
    return session ? this.#inspect(session) : undefined
  }

  useSession<T extends SessionData>(event: H3Event, config: SessionConfig): HarnessSession<T> {
    const name = config.name || 'h3'
    const context = eventContext(event)
    const eventSession = context.sessions.get(name)
    if (eventSession) return eventSession as HarnessSession<T>

    const cookieSessionId = context.requestCookies.get(name)
    const existing = this.#sessions.get(name)?.find((session) => session.id === cookieSessionId)
    const stored = existing || this.#createSession(name, cookieSessionId)
    stored.maxAge = config.maxAge

    const session = {
      id: stored.id,
      get data() {
        return stored.data as T
      },
      clear: async () => {
        stored.operations.push('clear')
        stored.clearCount += 1
        stored.data = {}
        queueCookie(event, name, undefined)
      },
      update: async (data: Partial<T>) => {
        const update = cloneData(data as Record<string, unknown>)
        stored.operations.push('update')
        stored.updates.push(update)
        Object.assign(stored.data, update)
        queueCookie(event, name, stored.id)
        return { id: stored.id, data: stored.data as T }
      },
    }
    context.sessions.set(name, session as HarnessSession<SessionData>)
    return session
  }

  #createSession(name: string, requestedId?: string): StoredSession {
    const session: StoredSession = {
      id: requestedId || `functional-session-${++this.#nextSessionId}`,
      name,
      data: {},
      clearCount: 0,
      updates: [],
      operations: [],
    }
    const sessions = this.#sessions.get(name) || []
    sessions.push(session)
    this.#sessions.set(name, sessions)
    return session
  }

  #inspect(session: StoredSession): SessionInspection {
    return cloneData(session)
  }
}

export interface HandlerHarnessOptions {
  runtimeConfig: Record<string, unknown>
  cookies?: Record<string, string>
}

export class HandlerHarness {
  readonly cookieJar: CookieJar
  readonly runtimeConfig: Record<string, unknown>
  readonly #storage = new Map<string, Map<string, unknown>>()

  constructor(options: HandlerHarnessOptions) {
    this.runtimeConfig = options.runtimeConfig
    this.cookieJar = new CookieJar(options.cookies)
    mockState.current = this
  }

  createEvent(options: FakeEventOptions): {
    commitResponseCookies: () => void
    event: H3Event
    response: HandlerResponse
  } {
    const method = options.method?.toUpperCase() || 'GET'
    const origin = options.origin || 'https://app.example.test'
    const requestUrl = new URL(options.path, origin)
    for (const [name, value] of Object.entries(options.query || {})) {
      for (const item of Array.isArray(value) ? value : [value]) {
        if (item !== undefined) requestUrl.searchParams.append(name, item)
      }
    }

    const requestCookies = new Map(Object.entries(this.cookieJar.entries()))
    for (const [name, value] of Object.entries(options.cookies || {})) {
      requestCookies.set(name, value)
    }
    const pendingCookies = new Map<string, string | undefined>()
    const response: HandlerResponse = { status: 200, headers: {} }
    const requestHeaders: Record<string, string> = {}
    for (const [name, value] of Object.entries(options.headers || {})) {
      requestHeaders[name.toLowerCase()] = value
    }
    const cookieHeader = [...requestCookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
    if (cookieHeader) requestHeaders.cookie = cookieHeader

    const event = {
      context: {
        handlerHarness: {
          body: options.body,
          jar: this.cookieJar,
          pendingCookies,
          query: options.query || {},
          requestCookies,
          requestUrl,
          response,
          sessions: new Map(),
        } satisfies EventHarnessContext,
      },
      method,
      path: requestUrl.pathname,
      node: {
        req: {
          headers: requestHeaders,
          method,
          url: `${requestUrl.pathname}${requestUrl.search}`,
        },
        res: {
          get statusCode() {
            return response.status
          },
          set statusCode(status: number) {
            response.status = status
          },
          getHeader: (name: string) => response.headers[name.toLowerCase()],
          removeHeader: (name: string) => delete response.headers[name.toLowerCase()],
          setHeader: (name: string, value: number | string | string[]) => {
            const normalizedName = name.toLowerCase()
            response.headers[normalizedName] = Array.isArray(value)
              ? value.map(String)
              : String(value)
            if (normalizedName === 'location') response.location = String(value)
          },
        },
      },
    } as unknown as H3Event

    return {
      commitResponseCookies: () => {
        for (const [name, value] of pendingCookies) {
          if (value === undefined) this.cookieJar.delete(name)
          else this.cookieJar.set(name, value)
        }
        pendingCookies.clear()
      },
      event,
      response,
    }
  }

  inspectSession(name: string): SessionInspection | undefined {
    return this.cookieJar.inspectSession(name)
  }

  inspectStorage(namespace: string): ReadonlyMap<string, unknown> {
    return this.#storageFor(namespace)
  }

  storage(namespace: string) {
    const data = this.#storageFor(namespace)
    return {
      getItem: async <T>(key: string) => (data.get(key) as T | undefined) ?? null,
      removeItem: async (key: string) => {
        data.delete(key)
      },
      setItem: async <T>(key: string, value: T) => {
        data.set(key, value)
      },
    }
  }

  #storageFor(namespace: string): Map<string, unknown> {
    const existing = this.#storage.get(namespace)
    if (existing) return existing
    const data = new Map<string, unknown>()
    this.#storage.set(namespace, data)
    return data
  }
}

export interface FetchRoute {
  method?: string
  url: string | RegExp
  respond: (request: Request) => Response | Promise<Response>
}

export function interceptFetch(routes: FetchRoute[]) {
  const requests: Request[] = []
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    requests.push(request)
    const route = routes.find(({ method, url }) => {
      const methodMatches = !method || request.method === method.toUpperCase()
      const urlMatches = typeof url === 'string' ? request.url === url : url.test(request.url)
      return methodMatches && urlMatches
    })
    if (!route) throw new Error(`Unexpected fetch: ${request.method} ${request.url}`)
    return await route.respond(request)
  })

  return {
    fetchMock,
    requests,
    restore: () => fetchMock.mockRestore(),
  }
}

export async function createRs256Fixture(kid: string = 'functional-test-key') {
  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true })
  const publicJwk = { ...(await exportJWK(publicKey)), alg: 'RS256', kid, use: 'sig' }
  const privateJwk = { ...(await exportJWK(privateKey)), alg: 'RS256', kid, use: 'sig' }

  return {
    jwks: { keys: [publicJwk] },
    privateJwk,
    publicJwk,
    sign: async (
      payload: Record<string, unknown>,
      options: { expiresIn?: number | string | Date } = {},
    ) => {
      let token = new SignJWT(payload).setProtectedHeader({ alg: 'RS256', kid })
      if (payload.iat === undefined) token = token.setIssuedAt()
      if (payload.exp === undefined) token = token.setExpirationTime(options.expiresIn ?? '5m')
      return await token.sign(privateKey)
    },
  }
}
