import type { H3Event, SessionConfig } from 'h3'

import type { HandlerResponse } from './handler-harness'

interface HarnessSession {
  id: string
  readonly data: Record<string, unknown>
  clear: () => Promise<void>
  update: (data: Record<string, unknown>) => Promise<{ data: Record<string, unknown>; id: string }>
}

interface StoredSession {
  id: string
  name: string
  maxAge?: number
  data: Record<string, unknown>
  clearCount: number
  updates: Record<string, unknown>[]
  operations: ('clear' | 'update')[]
}

export interface SessionInspection {
  id: string
  name: string
  maxAge?: number
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
  sessions: Map<string, HarnessSession>
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
    const eventSession = context.sessions.get(name)
    if (eventSession) {
      return eventSession
    }

    const cookieSessionId = context.requestCookies.get(name)
    const existing = this.#sessions.get(name)?.find((session) => session.id === cookieSessionId)
    const stored = existing ?? this.#createSession(name, cookieSessionId)
    stored.maxAge = config.maxAge

    // Like a sealed cookie, each request reads its own copy and writes the whole session back.
    let requestData = cloneData(stored.data)
    const session = {
      id: stored.id,
      get data() {
        return requestData
      },
      clear: async () => {
        stored.operations.push('clear')
        stored.clearCount += 1
        requestData = {}
        stored.data = {}
        queueCookie(event, name, undefined)
      },
      update: async (data: Record<string, unknown>) => {
        const update = cloneData(data)
        stored.operations.push('update')
        stored.updates.push(update)
        Object.assign(requestData, update)
        stored.data = cloneData(requestData)
        queueCookie(event, name, stored.id)
        return { id: stored.id, data: requestData }
      },
    }
    context.sessions.set(name, session)
    return session
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
