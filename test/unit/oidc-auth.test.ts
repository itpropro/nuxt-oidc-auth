import { ofetch } from 'ofetch'
import type { $Fetch } from 'ofetch'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UserSession } from '../../src/runtime/types'

const mocks = vi.hoisted(() => ({
  baseURL: '/',
  navigateTo:
    vi.fn<(path: string, options: { external: boolean; redirectCode: number }) => Promise<void>>(),
  requestFetch: undefined as $Fetch | undefined,
  session: { value: undefined as UserSession | undefined },
}))

// oxlint-disable-next-line anti-slop/no-module-mocking -- Nuxt app imports require its generated #build runtime.
vi.mock('nuxt/app', () => ({
  navigateTo: mocks.navigateTo,
  useRequestEvent: vi.fn<() => undefined>(),
  useRequestFetch: () => mocks.requestFetch,
  useRuntimeConfig: () => ({ app: { baseURL: mocks.baseURL } }),
  useState: () => mocks.session,
}))

beforeEach(() => {
  mocks.baseURL = '/'
  mocks.navigateTo.mockReset()
  mocks.navigateTo.mockResolvedValue()
  mocks.requestFetch = undefined
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
    expect(options).toStrictEqual({ external: true, redirectCode: 302 })
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

describe('useOidcAuth refresh', () => {
  it('keeps the session state and rejects when the provider is unavailable', async () => {
    const { useOidcAuth } = await import('../../src/runtime/composables/oidcAuth')
    const session: UserSession = { provider: 'oidc', canRefresh: true, expireAt: 1 }
    mocks.session.value = session
    mocks.requestFetch = ofetch.create(
      {},
      { fetch: async () => Response.json({ message: 'Provider unavailable' }, { status: 503 }) },
    )

    await expect(useOidcAuth().refresh()).rejects.toMatchObject({ statusCode: 503 })

    expect(mocks.navigateTo).not.toHaveBeenCalled()
    expect(mocks.session.value).toBe(session)
  })
})
