import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface ClientHarnessState {
  baseURL: string | undefined
  loggedIn: boolean
  singleSignOut: boolean
  setup?: () => void
  urls: string[]
}

const mocks = vi.hoisted<ClientHarnessState>(() => ({
  baseURL: '/',
  loggedIn: true,
  singleSignOut: true,
  urls: [],
}))

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt creates #imports during application builds; these adapters invoke the real plugin setup and ready callbacks.
vi.mock('#imports', () => ({
  defineNuxtPlugin: (plugin: () => void) => {
    mocks.setup = plugin
    return plugin
  },
  onNuxtReady: (callback: () => void) => {
    callback()
  },
  useOidcAuth: () => ({
    currentProvider: { value: 'oidc' },
    loggedIn: { value: mocks.loggedIn },
    logout: vi.fn<() => Promise<void>>(),
    refresh: vi.fn<() => Promise<void>>(),
    user: { value: { singleSignOut: mocks.singleSignOut } },
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
  mocks.loggedIn = true
  mocks.singleSignOut = true
  mocks.urls = []
  vi.stubGlobal('EventSource', EventSourceStub)
  vi.stubGlobal('addEventListener', vi.fn<(event: string, callback: () => void) => void>())
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
    await import('../../src/runtime/plugins/sso.client')

    if (!mocks.setup) {
      throw new Error('Expected Nuxt plugin setup callback')
    }
    mocks.setup()

    expect(mocks.urls).toStrictEqual([expected])
  })

  it.each([
    { loggedIn: false, singleSignOut: true },
    { loggedIn: true, singleSignOut: false },
  ])(
    'does not connect for loggedIn=$loggedIn and singleSignOut=$singleSignOut',
    async ({ loggedIn, singleSignOut }) => {
      mocks.loggedIn = loggedIn
      mocks.singleSignOut = singleSignOut
      await import('../../src/runtime/plugins/sso.client')

      if (!mocks.setup) {
        throw new Error('Expected Nuxt plugin setup callback')
      }
      mocks.setup()

      expect(mocks.urls).toStrictEqual([])
    },
  )
})
