import { fileURLToPath } from 'node:url'

import { startServer, url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'
import type { Router } from 'vue-router'

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

    // Hold the full-page login request so the client router outcome is observable before the page unloads.
    let loginRequested!: () => void
    const loginRequest = new Promise<void>((resolve) => {
      loginRequested = resolve
    })
    let releaseLogin!: () => void
    const loginReleased = new Promise<void>((resolve) => {
      releaseLogin = resolve
    })
    await page.route(
      (current) => current.pathname === '/auth/login',
      async (route) => {
        loginRequested()
        await loginReleased
        await route.continue()
      },
    )

    await goto(url('/excluded'), { waitUntil: 'hydration' })
    const navigationFinished = page.waitForEvent('console', {
      predicate: (message) => message.text().startsWith('oidc-navigation: '),
    })
    await page.evaluate(() => {
      const container = document.querySelector('#__nuxt')
      if (!container || !('__vue_app__' in container)) {
        throw new Error('Nuxt app is not mounted')
      }
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- SAFETY: Vue owns the checked mount property; Vue Router installs $router on globalProperties.
      const app = container['__vue_app__'] as { config: { globalProperties: { $router: Router } } }
      const router = app.config.globalProperties.$router
      const stop = router.afterEach((_to, _from, failure) => {
        stop()
        console.info(
          'oidc-navigation:',
          JSON.stringify({
            aborted: Boolean(failure),
            protectedPage: Boolean(document.querySelector('[name="protected"]')),
            publicPageVisible: document.querySelector('[name="excluded"]')?.checkVisibility(),
          }),
        )
      })
    })
    await page.getByRole('link', { name: 'Protected page' }).click()
    try {
      await loginRequest
      expect((await navigationFinished).text()).toBe(
        'oidc-navigation: {"aborted":true,"protectedPage":false,"publicPageVisible":true}',
      )
    } finally {
      releaseLogin()
    }
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
