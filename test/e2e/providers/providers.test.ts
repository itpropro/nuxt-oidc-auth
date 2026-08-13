import { expect, test } from '@nuxt/test-utils/playwright'
import { providerConfigs } from '../../fixtures/providers'
import { isProviderConfigured } from '../../setup/env-validator'

const appOrigin = 'http://localhost:31840'

for (const provider of providerConfigs) {
  test.describe(provider.name, () => {
    test('initiates authorization with default callback', async ({ request }) => {
      test.skip(!isProviderConfigured(provider.name), `${provider.name} not configured`)

      const response = await request.get(`${appOrigin}/auth/${provider.name}/login`, {
        maxRedirects: 0,
      })
      const location = response.headers().location

      expect(response.status()).toBe(302)
      expect(location).toBeTruthy()
      if (!location) throw new Error(`Missing ${provider.name} authorization redirect`)

      const authorizationUrl = new URL(location)
      expect(`${authorizationUrl.origin}${authorizationUrl.pathname}`).toMatch(
        provider.authorizationUrlPattern,
      )
      expect(authorizationUrl.searchParams.get('client_id')).toBeTruthy()
      expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(
        `${appOrigin}/auth/${provider.name}/callback`,
      )
      expect(authorizationUrl.searchParams.get('response_type')).toContain('code')
    })

    test('accepts an allowed custom callback', async ({ request }) => {
      test.skip(!isProviderConfigured(provider.name), `${provider.name} not configured`)

      const callback = `${appOrigin}/auth/${provider.name}/callback?source=matrix`
      const response = await request.get(`${appOrigin}/auth/${provider.name}/login`, {
        maxRedirects: 0,
        params: { redirectUri: callback },
      })
      const location = response.headers().location

      expect(response.status()).toBe(302)
      expect(location).toBeTruthy()
      if (!location) throw new Error(`Missing ${provider.name} authorization redirect`)
      expect(new URL(location).searchParams.get('redirect_uri')).toBe(callback)
    })

    if (provider.capabilities.fullLogin) {
      test('completes login and refreshes session', async ({ page }) => {
        await page.goto(`${appOrigin}/auth/${provider.name}/login`)
        await page.waitForURL(`${appOrigin}/`)

        await expect(page.locator('div[name="loggedIn"]')).toHaveText('true')
        await expect(page.locator('div[name="currentProvider"]')).toHaveText(provider.name)
        await expect(page.locator('div[name="userName"]')).toHaveText('Kilgore Trout')

        if (provider.capabilities.refresh) {
          const response = await page.request.post(`${appOrigin}/api/_auth/refresh`)
          expect(response.ok()).toBe(true)
          await page.reload()
          await expect(page.locator('div[name="loggedIn"]')).toHaveText('true')
        }
      })
    }
  })
}
