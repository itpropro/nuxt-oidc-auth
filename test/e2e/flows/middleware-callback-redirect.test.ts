import { fileURLToPath } from 'node:url'
import { url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/oidcApp', import.meta.url)),
    build: true,
  },
})

test.describe('Middleware Callback Redirect', () => {
  test('redirect to login includes original target callback redirect url', async () => {
    const targetPath = '/?target=middleware-callback'
    const response = await fetch(url(targetPath), { redirect: 'manual' })

    expect(response.status).toBe(302)

    const location = response.headers.get('location')
    expect(location).toBeTruthy()
    if (!location) {
      throw new Error('Missing redirect location')
    }

    const redirectedLocation = new URL(location, url('/'))
    expect(redirectedLocation.pathname).toBe('/auth/login')
    expect(redirectedLocation.searchParams.get('callbackRedirectUrl')).toBe(targetPath)
  })
})
