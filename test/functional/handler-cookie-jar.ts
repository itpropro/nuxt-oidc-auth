import type { H3Event, SessionConfig } from 'h3'

import type { HandlerResponse } from './handler-harness'

interface HarnessSession {
  readonly id: string
  readonly data: Record<string, unknown>
  clear: () => Promise<void>
  update: (data: Record<string, unknown>) => Promise<{ data: Record<string, unknown>; id: string }>
}

interface StoredSession {
  id: string
  name: string
  maxAge?: number
  cookie?: SessionConfig['cookie']
  data: Record<string, unknown>
  clearCount: number
  updates: Record<string, unknown>[]
  operations: ('clear' | 'update')[]
}

export interface SessionInspection {
  id: string
  name: string
  maxAge?: number
  cookie?: SessionConfig['cookie']
  data: Record<string, unknown>
  clearCount: number
  updates: Record<string, unknown>[]
  operations: ('clear' | 'update')[]
}

export interface EventHarnessContext {
  body: unknown
  jar: CookieJar
  pendingCookies: Map<string, string | undefined>
  query: Record<string, string | string[] | undefined>
  requestCookies: ReadonlyMap<string, string>
  requestUrl: URL
  response: HandlerResponse
}

const contexts = new WeakMap<H3Event, EventHarnessContext>()

export function registerEventContext(event: H3Event, context: EventHarnessContext): void {
  contexts.set(event, context)
}

export function eventContext(event: H3Event): EventHarnessContext {
  const context = contexts.get(event)
  if (!context) {
    throw new Error('Event was not created by HandlerHarness')
  }
  return context
}

function appendSetCookie(event: H3Event, value: string): void {
  const response = eventContext(event).response
  const existing = response.headers['set-cookie']
  response.headers['set-cookie'] =
    existing === undefined ? [value] : [...(Array.isArray(existing) ? existing : [existing]), value]
}

export function queueCookie(event: H3Event, name: string, value: string | undefined): void {
  const context = eventContext(event)
  context.pendingCookies.set(name, value)
  appendSetCookie(
    event,
    value === undefined
      ? `${name}=; Max-Age=0; Path=/`
      : `${name}=${encodeURIComponent(value)}; Path=/`,
  )
}

function cloneData<T>(value: T): T {
  return structuredClone(value)
}

export class CookieJar {
  readonly #cookies = new Map<string, string>()
  readonly #sessions = new Map<string, StoredSession[]>()
  #nextSessionId = 0

  constructor(cookies: Record<string, string> = {}) {
    for (const [name, value] of Object.entries(cookies)) {
      this.set(name, value)
    }
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

  seedSession(name: string, data: Record<string, unknown>, id?: string): SessionInspection {
    const session = this.#createSession(name, id)
    session.data = cloneData(data)
    this.#cookies.set(name, session.id)
    return this.#inspect(session)
  }

  inspectSession(name: string): SessionInspection | undefined {
    const sessions = this.#sessions.get(name)
    const session = sessions?.at(-1)
    return session ? this.#inspect(session) : undefined
  }

  findSession(name: string, id: string): SessionInspection | undefined {
    const session = this.#sessions.get(name)?.find((candidate) => candidate.id === id)
    return session ? this.#inspect(session) : undefined
  }

  useSession(event: H3Event, config: SessionConfig): HarnessSession {
    const name = config.name ?? 'h3'
    const context = eventContext(event)
    // Like h3, each request keeps its session in the event context, so replacing it there switches
    // the session ID.
    event.context.sessions ??= {}
    const sessions = event.context.sessions
    if (!sessions[name]) {
      const cookieSessionId = context.requestCookies.get(name)
      const existing = this.#sessions.get(name)?.find((session) => session.id === cookieSessionId)
      const stored = existing ?? this.#createSession(name, cookieSessionId)
      stored.maxAge = config.maxAge
      stored.cookie = config.cookie
      // Like a sealed cookie, each request reads its own copy and writes the whole session back.
      sessions[name] = { id: stored.id, createdAt: Date.now(), data: cloneData(stored.data) }
    }
    const current = () => {
      const session = event.context.sessions?.[name]
      if (!session) {
        throw new Error(`Session ${name} is not loaded`)
      }
      return session
    }
    const storedFor = (id: string) => {
      const stored = this.#sessions.get(name)?.find((session) => session.id === id)
      return stored ?? this.#createSession(name, id)
    }

    return {
      get id() {
        return current().id
      },
      get data() {
        return current().data
      },
      clear: async () => {
        const session = current()
        const stored = storedFor(session.id)
        stored.operations.push('clear')
        stored.clearCount += 1
        session.data = {}
        stored.data = {}
        queueCookie(event, name, undefined)
      },
      update: async (data: Record<string, unknown>) => {
        const session = current()
        const update = cloneData(data)
        const stored = storedFor(session.id)
        stored.maxAge = config.maxAge
        stored.cookie = config.cookie
        stored.operations.push('update')
        stored.updates.push(update)
        Object.assign(session.data, update)
        stored.data = cloneData(session.data)
        queueCookie(event, name, stored.id)
        return { id: stored.id, data: session.data }
      },
    }
  }

  #createSession(name: string, requestedId?: string): StoredSession {
    const session: StoredSession = {
      id: requestedId ?? `functional-session-${++this.#nextSessionId}`,
      name,
      data: {},
      clearCount: 0,
      updates: [],
      operations: [],
    }
    const sessions = this.#sessions.get(name) ?? []
    sessions.push(session)
    this.#sessions.set(name, sessions)
    return session
  }

  #inspect(session: StoredSession): SessionInspection {
    return cloneData(session)
  }
}
