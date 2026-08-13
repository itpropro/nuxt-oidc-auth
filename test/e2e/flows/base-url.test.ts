/**
 * BaseURL Support E2E Tests - Default Root Path (Baseline)
 *
 * Tests for GitHub Issue #60: Support different application baseURL than '/'
 * Establishes baseline behavior with default root baseURL for comparison.
 */

import { expect, test } from '@nuxt/test-utils/playwright'

const appOrigin = 'http://localhost:31840'
const appUrl = (path: string) => new URL(path, appOrigin).toString()

test.describe('Issue #60: BaseURL Support - Default Root Path (Baseline)', () => {
  test('auth login route returns redirect to provider', async () => {
    const loginUrl = appUrl('/auth/oidc/login')
    const response = await fetch(loginUrl, { redirect: 'manual' })
    expect([302, 303, 307, 308]).toContain(response.status)
  })

  test('login page is accessible without callback redirect', async () => {
    const loginPageUrl = appUrl('/auth/login')
    const response = await fetch(loginPageUrl)

    expect(response.status).toBe(200)
  })

  test('unauthenticated user is redirected to /auth/login with preserved callback redirect', async () => {
    const rootUrl = appUrl('/')
    const response = await fetch(rootUrl, { redirect: 'manual' })
    const location = response.headers.get('location')

    expect(response.status).toBe(302)
    expect(location).toBeTruthy()
    if (!location) {
      throw new Error('Missing redirect location')
    }

    const redirectedLocation = new URL(location, appUrl('/'))
    expect(redirectedLocation.pathname).toBe('/auth/login')
    expect(redirectedLocation.searchParams.get('callbackRedirectUrl')).toBe('/')
  })

  test('API session endpoint returns 200', async () => {
    const sessionUrl = appUrl('/api/_auth/session')
    const response = await fetch(sessionUrl, {
      headers: { Accept: 'application/json' },
    })
    expect(response.status).toBe(200)
  })

  test('auth callback route exists', async () => {
    const callbackUrl = appUrl('/auth/oidc/callback')
    const response = await fetch(callbackUrl, { redirect: 'manual' })
    expect(response.status).not.toBe(404)
  })

  test('auth logout route exists', async () => {
    const logoutUrl = appUrl('/auth/oidc/logout')
    const response = await fetch(logoutUrl, { redirect: 'manual' })
    expect(response.status).not.toBe(404)
  })
})
