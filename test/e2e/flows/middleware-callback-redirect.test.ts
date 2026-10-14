import { expect, test } from '@nuxt/test-utils/playwright'

const appUrl = (path: string) => new URL(path, 'http://localhost:31840').toString()

test.describe('Middleware Callback Redirect', () => {
  test('redirect to login includes original target callback redirect url', async () => {
    const targetPath = '/?target=middleware-callback'
    const response = await fetch(appUrl(targetPath), { redirect: 'manual' })

    expect(response.status).toBe(302)

    const location = response.headers.get('location')
    expect(location).toBeTruthy()
    if (location === null || location === '') {
      throw new Error('Missing redirect location')
    }

    const redirectedLocation = new URL(location, appUrl('/'))
    expect(redirectedLocation.pathname).toBe('/auth/login')
    expect(redirectedLocation.searchParams.get('callbackRedirectUrl')).toBe(targetPath)
  })

  test('renders pages that select oidc-auth for logged in users', async ({ page }) => {
    // The global guard has already redirected logged out users, so only a logged in request reaches the named lookup.
    const sessionResponse = await page.request.post(appUrl('/api/test/session-sso'))
    expect(sessionResponse.ok()).toBe(true)

    const response = await page.request.get(appUrl('/protected'), { maxRedirects: 0 })
    expect(response.status()).toBe(200)
    expect(await response.text()).toContain('name="protected"')
  })
})
