/**
 * Middleware Redirect Configuration E2E Tests
 *
 * Tests that the middleware respects the redirect configuration option.
 * When redirect is set to false, unauthenticated users should not be redirected.
 */

import { fileURLToPath } from 'node:url'
import { url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/oidcApp', import.meta.url)),
    build: true,
    nuxtConfig: {
      oidc: {
        middleware: {
          globalMiddlewareEnabled: true,
          redirect: false,
        },
      },
    },
  },
})

test.describe('Middleware Redirect Configuration', () => {
  test('unauthenticated user is not redirected when redirect is false', async () => {
    const rootUrl = url('/')
    const response = await fetch(rootUrl, { redirect: 'manual' })

    expect(response.status).toBe(200)
  })

  test('protected pages are accessible without authentication when redirect is false', async () => {
    const rootUrl = url('/')
    const response = await fetch(rootUrl)

    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('<!DOCTYPE html>')
  })

  test('auth routes still work when redirect is false', async () => {
    const loginUrl = url('/auth/oidc/login')
    const response = await fetch(loginUrl, { redirect: 'manual' })

    expect(response.status).toBe(302)
  })
})
