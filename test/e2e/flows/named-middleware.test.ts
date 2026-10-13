import { fileURLToPath } from 'node:url'
import { startServer, url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/oidcApp', import.meta.url)),
    build: true,
    nuxtConfig: {
      oidc: {
        middleware: {
          globalMiddlewareEnabled: false,
        },
      },
    },
  },
})

test.describe.configure({ mode: 'serial' })

const protectedPath = '/protected?from=excluded'

test.describe('Named oidc-auth middleware', () => {
  test('redirects unauthenticated users only on pages that select it', async ({ page, goto }) => {
    const publicResponse = await fetch(url('/'), { redirect: 'manual' })
    expect(publicResponse.status).toBe(200)

    const protectedResponse = await fetch(url(protectedPath), { redirect: 'manual' })
    expect(protectedResponse.status).toBe(302)
    const location = new URL(protectedResponse.headers.get('location') ?? '', url('/'))
    expect(location.pathname).toBe('/auth/login')
    expect(location.searchParams.get('callbackRedirectUrl')).toBe(protectedPath)

    await goto(url('/excluded'), { waitUntil: 'hydration' })
    await page.getByRole('link', { name: 'Protected page' }).click()
    await page.waitForURL((current) => current.pathname === '/auth/login')
    expect(new URL(page.url()).searchParams.get('callbackRedirectUrl')).toBe(protectedPath)
  })

  test('lets authenticated users navigate to protected pages', async ({ page, goto }) => {
    const sessionResponse = await page.request.post(url('/api/test/session-sso'))
    expect(sessionResponse.ok()).toBe(true)

    await goto(url('/excluded'), { waitUntil: 'hydration' })
    await page.getByRole('link', { name: 'Protected page' }).click()
    await expect(page.locator('[name="protected"]')).toBeVisible()
    expect(page.url()).toBe(url(protectedPath))
  })

  test('honors a runtime redirect override on the server and in the browser', async ({
    page,
    goto,
  }) => {
    await startServer({ env: { NUXT_OIDC_MIDDLEWARE_REDIRECT: 'false' } })
    try {
      const response = await fetch(url(protectedPath), { redirect: 'manual' })
      expect(response.status).toBe(200)

      await goto(url('/excluded'), { waitUntil: 'hydration' })
      await page.getByRole('link', { name: 'Protected page' }).click()
      await expect(page.locator('[name="protected"]')).toBeVisible()
      expect(page.url()).toBe(url(protectedPath))
    } finally {
      await startServer()
    }
  })
})
