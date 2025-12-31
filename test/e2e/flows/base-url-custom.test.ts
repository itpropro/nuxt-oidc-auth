/**
 * Custom BaseURL Support E2E Tests
 *
 * Tests for GitHub Issue #60: Support different application baseURL than '/'
 * Verifies that auth routes correctly respect app.baseURL configuration.
 * Uses direct URL construction to properly verify prefix handling.
 */

import { fileURLToPath } from 'node:url'
import { url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/oidcApp', import.meta.url)),
    build: true,
    nuxtConfig: {
      app: {
        baseURL: '/prefix/',
      },
    },
  },
})

function getServerOrigin(): string {
  const baseUrl = url('/')
  return new URL(baseUrl).origin
}

test.describe('Issue #60: BaseURL Support - Custom Prefix /prefix/', () => {
  test('callback route is accessible at prefixed path', async () => {
    const origin = getServerOrigin()
    const response = await fetch(`${origin}/prefix/auth/oidc/callback`, { redirect: 'manual' })
    expect(response.status).not.toBe(404)
  })

  test('logout route is accessible at prefixed path', async () => {
    const origin = getServerOrigin()
    const response = await fetch(`${origin}/prefix/auth/oidc/logout`, { redirect: 'manual' })
    expect(response.status).not.toBe(404)
  })

  test('API session endpoint is accessible at prefixed path', async () => {
    const origin = getServerOrigin()
    const response = await fetch(`${origin}/prefix/api/_auth/session`, {
      headers: { Accept: 'application/json' },
    })
    expect(response.status).toBe(200)
  })

  test('provider login route redirects to OAuth provider', async () => {
    const origin = getServerOrigin()
    const response = await fetch(`${origin}/prefix/auth/oidc/login`, { redirect: 'manual' })
    expect(response.status).toBe(302)
    const location = response.headers.get('location')
    expect(location).toBeTruthy()
  })

  test('redirect from prefixed root includes prefix in auth path', async () => {
    const origin = getServerOrigin()
    const response = await fetch(`${origin}/prefix/`, { redirect: 'manual' })
    const location = response.headers.get('location')

    expect(response.status).toBe(302)
    expect(location).toBeTruthy()

    const redirectsWithPrefix = location?.includes('/prefix/') || location?.startsWith('/prefix/')
    const redirectsWithoutPrefix = location === '/auth/login' || location === '/auth/'

    expect(redirectsWithoutPrefix).toBe(false)
    expect(redirectsWithPrefix).toBe(true)
  })

  test('custom login page is accessible at prefixed path', async () => {
    const origin = getServerOrigin()
    const response = await fetch(`${origin}/prefix/auth/login`, { redirect: 'manual' })

    expect(response.status).toBe(200)
  })

  test('non-prefixed root does not serve app with unprefixed auth redirect', async () => {
    const origin = getServerOrigin()
    const response = await fetch(`${origin}/`, { redirect: 'manual' })
    const location = response.headers.get('location')

    const redirectsToUnprefixedAuth = response.status === 302 && location === '/auth/login'
    expect(redirectsToUnprefixedAuth).toBe(false)
  })

  test('non-prefixed auth login is not accessible', async () => {
    const origin = getServerOrigin()
    const response = await fetch(`${origin}/auth/oidc/login`, { redirect: 'manual' })

    const isDirectlyAccessible = response.status === 302 && response.headers.get('location')?.includes('authorize')
    expect(isDirectlyAccessible).toBe(false)
  })
})
