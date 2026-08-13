import { expect, test } from '@nuxt/test-utils/playwright'
import { startFaultOidcProvider } from '../../setup/fault-oidc-provider'

const appOrigin = 'http://localhost:31840'
const logoutRedirectTarget = `${appOrigin}/excluded?next=one&value=two#resume path`
const expectedLogoutRedirect = new URL(logoutRedirectTarget).toString()
let provider: Awaited<ReturnType<typeof startFaultOidcProvider>>

test.beforeAll(async () => {
  provider = await startFaultOidcProvider(expectedLogoutRedirect, 5557)
})

test.afterAll(async () => {
  await provider.close()
})

test('preserves current session data across integrated browser flows', async ({ page }) => {
  provider.reset()

  await page.goto(`${appOrigin}/auth/keycloak/login`)
  await page.waitForURL(`${appOrigin}/`)

  await expect(page.locator('div[name="userName"]')).toHaveText('first-user')
  await expect(page.locator('div[name="claims"]')).toContainText('admin-role')
  await expect(page.locator('div[name="userInfo"]')).toContainText('First User')

  await page.context().request.post(`${appOrigin}/api/test/session-stale`)
  await page.click('button[name="refresh"]')
  await expect(page.locator('div[name="userName"]')).toHaveText('first-user')
  await expect(page.locator('div[name="claims"]')).toContainText('user-role')
  await expect(page.locator('div[name="claims"]')).not.toContainText('admin-role')

  const { releaseTokenRequest, tokenRequestReached } = provider.blockNextTokenRequest()
  const cookieHeader = (await page.context().cookies(appOrigin))
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ')

  await page.evaluate(
    (loginUrl) => window.location.assign(loginUrl),
    `${appOrigin}/auth/keycloak/login`,
  )
  await tokenRequestReached

  try {
    const staleResponse = await fetch(`${appOrigin}/auth/keycloak/callback`, {
      headers: { cookie: cookieHeader },
      redirect: 'manual',
    })
    expect(staleResponse.status).toBe(302)
  } finally {
    releaseTokenRequest()
  }
  await expect.poll(() => provider.getTokenRequestCount()).toBe(3)

  const logoutResponse = await fetch(
    `${appOrigin}/auth/keycloak/logout?logoutRedirectUri=${encodeURIComponent(logoutRedirectTarget)}`,
    { headers: { cookie: cookieHeader } },
  )

  expect(provider.getLastLogoutRedirect()).toBe(logoutRedirectTarget)
  expect(logoutResponse.url).toBe(expectedLogoutRedirect.split('#')[0])
})
