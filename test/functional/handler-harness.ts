import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'

import type { H3Event, SessionConfig } from 'h3'
import { createEvent } from 'h3'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'
import { afterEach, beforeEach, vi } from 'vitest'

import type { SessionInspection } from './handler-cookie-jar'
import { CookieJar, eventContext, queueCookie, registerEventContext } from './handler-cookie-jar'

export { CookieJar } from './handler-cookie-jar'

export interface HandlerResponse {
  status: number
  headers: Record<string, string | string[]>
  location?: string
  eventStream?: {
    closed: boolean
    messages: { data: string; event?: string }[]
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

interface HarnessState {
  current?: HandlerHarness
}

const mockState = vi.hoisted<HarnessState>(() => ({}))

beforeEach(() => {
  vi.stubEnv('NUXT_OIDC_AUTH_SESSION_SECRET', 'test-auth-session-secret-at-least-32-characters')
  vi.stubEnv('NUXT_OIDC_SESSION_SECRET', 'test-session-secret-at-least-32-characters')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function activeHarness(): HandlerHarness {
  if (!mockState.current) {
    throw new Error('Create a handler harness before invoking a handler')
  }
  return mockState.current
}

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt generates #imports only inside an application build.
vi.mock('#imports', () => ({
  useRuntimeConfig: () => activeHarness().runtimeConfig,
}))

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nitro storage depends on generated virtual modules; this adapter shares state across real handler calls.
vi.mock('nitropack/runtime', () => ({
  useStorage: (namespace: string) => activeHarness().storage(namespace),
}))

// oxlint-disable-next-line anti-slop/no-module-mocking -- Faithful request, cookie, session, and stream adapters make handler effects observable without a server.
vi.mock('h3', async (importOriginal) => {
  // oxlint-disable-next-line typescript/consistent-type-imports -- Vitest importOriginal requires an inline module type
  const actual = await importOriginal<typeof import('h3')>()
  return {
    ...actual,
    createEventStream: (event: H3Event) => {
      const response = eventContext(event).response
      const closeHandlers: (() => void | Promise<void>)[] = []
      const stream: NonNullable<HandlerResponse['eventStream']> = {
        closed: false,
        messages: [],
        sent: false,
        close: async () => {
          stream.closed = true
          await Promise.all(
            closeHandlers.map(async (handler) => {
              await handler()
            }),
          )
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
    readBody: async (event: H3Event) => eventContext(event).body,
    sendRedirect: (event: H3Event, location: string, status = 302) => {
      const response = eventContext(event).response
      response.status = status
      response.location = location
      response.headers['location'] = location
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
    unsealSession: async (event: H3Event, config: SessionConfig, sealed: string) => {
      const session = eventContext(event).jar.findSession(config.name ?? 'h3', sealed)
      if (!session) {
        throw new Error('Invalid session')
      }
      return session
    },
    useSession: async (event: H3Event, config: SessionConfig) =>
      eventContext(event).jar.useSession(event, config),
  }
})

export interface HandlerHarnessOptions {
  runtimeConfig: Record<string, unknown>
  cookies?: Record<string, string>
}

export class HandlerHarness {
  readonly cookieJar: CookieJar
  readonly runtimeConfig: Record<string, unknown>
  readonly #storage = new Map<string, Map<string, Record<string, unknown>>>()

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
    const method = options.method?.toUpperCase() ?? 'GET'
    const origin = options.origin ?? 'https://app.example.test'
    const requestUrl = new URL(options.path, origin)
    for (const [name, value] of Object.entries(options.query ?? {})) {
      for (const item of Array.isArray(value) ? value : [value]) {
        if (item !== undefined) {
          requestUrl.searchParams.append(name, item)
        }
      }
    }

    const requestCookies = new Map(Object.entries(this.cookieJar.entries()))
    for (const [name, value] of Object.entries(options.cookies ?? {})) {
      requestCookies.set(name, value)
    }
    const pendingCookies = new Map<string, string | undefined>()
    const response: HandlerResponse = { status: 200, headers: {} }
    const requestHeaders: Record<string, string> = {}
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      requestHeaders[name.toLowerCase()] = value
    }
    const cookieHeader = Array.from(
      requestCookies.entries(),
      ([name, value]) => `${name}=${value}`,
    ).join('; ')
    if (cookieHeader) {
      requestHeaders['cookie'] = cookieHeader
    }

    const request = new IncomingMessage(new Socket())
    request.headers = requestHeaders
    request.method = method
    request.url = requestUrl.pathname
    const nodeResponse = new ServerResponse(request)
    vi.spyOn(nodeResponse, 'setHeader').mockImplementation((name, value) => {
      const normalizedName = name.toLowerCase()
      response.headers[normalizedName] = Array.isArray(value) ? value.map(String) : String(value)
      if (normalizedName === 'location') {
        response.location = String(value)
      }
      return nodeResponse
    })
    const event = createEvent(request, nodeResponse)
    registerEventContext(event, {
      body: options.body,
      jar: this.cookieJar,
      pendingCookies,
      query: options.query ?? {},
      requestCookies,
      requestUrl,
      response,
      sessions: new Map(),
    })

    return {
      commitResponseCookies: () => {
        for (const [name, value] of pendingCookies) {
          if (value === undefined) {
            this.cookieJar.delete(name)
          } else {
            this.cookieJar.set(name, value)
          }
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

  inspectStorage(namespace: string): ReadonlyMap<string, Record<string, unknown>> {
    return this.#storageFor(namespace)
  }

  storage(namespace: string) {
    const data = this.#storageFor(namespace)
    return {
      getItem: async (key: string) => data.get(key) ?? null,
      removeItem: async (key: string) => {
        data.delete(key)
      },
      setItem: async (key: string, value: Record<string, unknown>) => {
        data.set(key, value)
      },
    }
  }

  #storageFor(namespace: string): Map<string, Record<string, unknown>> {
    const existing = this.#storage.get(namespace)
    if (existing) {
      return existing
    }
    const data = new Map<string, Record<string, unknown>>()
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
      const methodMatches = method === undefined || request.method === method.toUpperCase()
      const urlMatches = typeof url === 'string' ? request.url === url : url.test(request.url)
      return methodMatches && urlMatches
    })
    if (!route) {
      throw new Error(`Unexpected fetch: ${request.method} ${request.url}`)
    }
    return await route.respond(request)
  })

  return {
    fetchMock,
    requests,
    restore: () => {
      fetchMock.mockRestore()
    },
  }
}

export async function createRs256Fixture(kid = 'functional-test-key') {
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
      if (payload['iat'] === undefined) {
        token = token.setIssuedAt()
      }
      if (payload['exp'] === undefined) {
        token = token.setExpirationTime(options.expiresIn ?? '5m')
      }
      return await token.sign(privateKey)
    },
  }
}
