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
      expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(provider.config.redirectUri)
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

    const loginPage = provider.loginPage
    if (loginPage) {
      test('displays provider login page', async ({ page }) => {
        test.skip(!isProviderConfigured(provider.name), `${provider.name} not configured`)

        await loginPage.open(page, `${appOrigin}/auth/${provider.name}/login`)
        await expect(page.locator(loginPage.selector)).toBeVisible({ timeout: 10_000 })
      })
    }

    const logoutRedirect = provider.capabilities.logoutRedirect
    if (logoutRedirect) {
      test('initiates provider logout with configured redirect', async ({ request }) => {
        test.skip(!isProviderConfigured(provider.name), `${provider.name} not configured`)

        const sessionResponse = await request.post(`${appOrigin}/api/test/session-sso`)
        expect(sessionResponse.ok()).toBe(true)

        const response = await request.get(`${appOrigin}/auth/${provider.name}/logout`, {
          maxRedirects: 0,
        })
        const location = response.headers().location

        expect(response.status()).toBe(302)
        expect(location).toBeTruthy()
        if (!location) throw new Error(`Missing ${provider.name} logout redirect`)

        const logoutUrl = new URL(location)
        expect(`${logoutUrl.origin}${logoutUrl.pathname}`).toBe(logoutRedirect.url)
        expect(logoutUrl.searchParams.get(logoutRedirect.parameterName)).toBe(appOrigin)
      })
    }

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
