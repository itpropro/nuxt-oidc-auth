import { expect, test } from '@nuxt/test-utils/playwright'

const appUrl = (path: string) => new URL(path, 'http://localhost:31840').toString()

test.describe('Middleware Callback Redirect', () => {
  test('redirect to login includes original target callback redirect url', async () => {
    const targetPath = '/?target=middleware-callback'
    const response = await fetch(appUrl(targetPath), { redirect: 'manual' })

    expect(response.status).toBe(302)

    const location = response.headers.get('location')
    expect(location).toBeTruthy()
    if (!location) {
      throw new Error('Missing redirect location')
    }

    const redirectedLocation = new URL(location, appUrl('/'))
    expect(redirectedLocation.pathname).toBe('/auth/login')
    expect(redirectedLocation.searchParams.get('callbackRedirectUrl')).toBe(targetPath)
  })
})
