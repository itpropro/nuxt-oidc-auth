import type { UserSession } from '../../src/runtime/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  baseURL: '/',
  navigateTo:
    vi.fn<(path: string, options: { external: boolean; redirectCode: number }) => Promise<void>>(),
  session: { value: undefined as UserSession | undefined },
}))

vi.mock('#imports', () => ({
  computed: <T>(getter: () => T) => ({
    get value(): T {
      return getter()
    },
  }),
  navigateTo: mocks.navigateTo,
  useRequestEvent: vi.fn<() => undefined>(),
  useRequestFetch: vi.fn<() => never>(),
  useRuntimeConfig: () => ({ app: { baseURL: mocks.baseURL } }),
  useState: () => mocks.session,
}))

beforeEach(() => {
  mocks.baseURL = '/'
  mocks.navigateTo.mockReset()
  mocks.navigateTo.mockResolvedValue()
  mocks.session.value = undefined
})

describe('useOidcAuth logout', () => {
  it('emits the canonical encoded redirect query', async () => {
    const { useOidcAuth } = await import('../../src/runtime/composables/oidcAuth')
    const redirectUri = 'https://app.example.test/after?next=one&value=two#résumé path'

    await useOidcAuth().logout('oidc', redirectUri)

    expect(mocks.navigateTo).toHaveBeenCalledOnce()
    const [path, options] = mocks.navigateTo.mock.calls[0]!
    const logoutUrl = new URL(path, 'https://app.example.test')
    expect(logoutUrl.pathname).toBe('/auth/oidc/logout')
    expect(logoutUrl.searchParams.get('logoutRedirectUri')).toBe(redirectUri)
    expect(logoutUrl.searchParams.has('logout_redirect_uri')).toBe(false)
    expect(options).toEqual({ external: true, redirectCode: 302 })
  })

  it('keeps logout navigation unchanged without a redirect', async () => {
    const { useOidcAuth } = await import('../../src/runtime/composables/oidcAuth')

    await useOidcAuth().logout('oidc')

    expect(mocks.navigateTo).toHaveBeenCalledWith('/auth/oidc/logout', {
      external: true,
      redirectCode: 302,
    })
  })
})
