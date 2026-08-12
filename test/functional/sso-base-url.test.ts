import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  baseURL: '/' as string | undefined,
  urls: [] as string[],
}))

vi.mock('#imports', () => ({
  defineNuxtPlugin: (plugin: () => void) => plugin,
  onNuxtReady: (callback: () => void) => callback(),
  useOidcAuth: () => ({
    currentProvider: { value: 'oidc' },
    loggedIn: { value: true },
    logout: vi.fn<() => Promise<void>>(),
    refresh: vi.fn<() => Promise<void>>(),
    user: { value: { singleSignOut: true } },
  }),
  useRuntimeConfig: () => ({ app: { baseURL: mocks.baseURL } }),
}))

class EventSourceStub {
  static readonly CLOSED = 2
  readonly readyState = 1
  onerror: (() => void) | null = null
  onopen: (() => void) | null = null

  constructor(url: string | URL) {
    mocks.urls.push(String(url))
  }

  addEventListener(): void {}

  close(): void {}
}

beforeEach(() => {
  mocks.urls = []
  vi.stubGlobal('EventSource', EventSourceStub)
  vi.stubGlobal('window', {
    addEventListener: vi.fn<(event: string, callback: () => void) => void>(),
    setTimeout: vi.fn<(callback: () => void, delay: number) => number>(),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('single sign-out base URL', () => {
  it.each([
    { baseURL: undefined, expected: '/api/_auth/sso' },
    { baseURL: '/', expected: '/api/_auth/sso' },
    { baseURL: '/prefix/', expected: '/prefix/api/_auth/sso' },
    { baseURL: '/prefix', expected: '/prefix/api/_auth/sso' },
    { baseURL: '/api/', expected: '/api/api/_auth/sso' },
    { baseURL: '/api', expected: '/api/api/_auth/sso' },
  ])('connects to $expected for baseURL $baseURL', async ({ baseURL, expected }) => {
    mocks.baseURL = baseURL
    const plugin = (await import('../../src/runtime/plugins/sso.client')).default

    if (typeof plugin !== 'function') throw new Error('Expected functional Nuxt plugin')
    void plugin({} as never)

    expect(mocks.urls).toEqual([expected])
  })
})
