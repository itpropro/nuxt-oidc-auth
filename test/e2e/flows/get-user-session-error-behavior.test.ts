import { url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'

test.describe('getUserSession error behavior', () => {
  test('returns 401 when throw behavior is used', async () => {
    const response = await fetch(url('/api/test/get-user-session-throw'), {
      redirect: 'manual',
      headers: {
        Accept: 'application/json',
      },
    })

    expect(response.status).toBe(401)
  })

  test('returns redirect response when redirect behavior is used', async () => {
    const response = await fetch(url('/api/test/get-user-session-redirect'), {
      redirect: 'manual',
    })

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/')
  })
})
