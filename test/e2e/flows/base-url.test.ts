/**
 * BaseURL Support E2E Tests - Default Root Path (Baseline)
 *
 * Tests for GitHub Issue #60: Support different application baseURL than '/'
 * Establishes baseline behavior with default root baseURL for comparison.
 */

import { fileURLToPath } from 'node:url'
import { url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/oidcApp', import.meta.url)),
    build: true,
  },
})

test.describe('Issue #60: BaseURL Support - Default Root Path (Baseline)', () => {
  test('auth login route returns redirect to provider', async () => {
    const loginUrl = url('/auth/oidc/login')
    const response = await fetch(loginUrl, { redirect: 'manual' })
    expect([302, 303, 307, 308]).toContain(response.status)
  })

  test('unauthenticated user is redirected to /auth/login', async () => {
    const rootUrl = url('/')
    const response = await fetch(rootUrl, { redirect: 'manual' })
    const location = response.headers.get('location')

    expect(response.status).toBe(302)
    expect(location).toBe('/auth/login')
  })

  test('API session endpoint returns 200', async () => {
    const sessionUrl = url('/api/_auth/session')
    const response = await fetch(sessionUrl, {
      headers: { Accept: 'application/json' },
    })
    expect(response.status).toBe(200)
  })

  test('auth callback route exists', async () => {
    const callbackUrl = url('/auth/oidc/callback')
    const response = await fetch(callbackUrl, { redirect: 'manual' })
    expect(response.status).not.toBe(404)
  })

  test('auth logout route exists', async () => {
    const logoutUrl = url('/auth/oidc/logout')
    const response = await fetch(logoutUrl, { redirect: 'manual' })
    expect(response.status).not.toBe(404)
  })
})
