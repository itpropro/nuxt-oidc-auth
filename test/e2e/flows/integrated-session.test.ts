import { expect, test } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'
import { startFaultOidcProvider, type TokenFault } from '../../setup/fault-oidc-provider'

const appOrigin = 'http://localhost:31840'
const logoutRedirectTarget = `${appOrigin}/excluded?next=one&value=two#resume path`
const expectedLogoutRedirect = new URL(logoutRedirectTarget).toString()
let provider: Awaited<ReturnType<typeof startFaultOidcProvider>>

test.beforeAll(async () => {
  provider = await startFaultOidcProvider(expectedLogoutRedirect, 5557)
})

test.afterAll(async () => {
  try {
    const modeResponse = await fetch('http://127.0.0.1:31841/dex', {
      method: 'POST',
    })
    if (!modeResponse.ok) throw new Error('Failed to restore Dex app mode')
  } finally {
    await provider.close()
  }
})

test('preserves current session data across integrated browser flows', async ({ page }) => {
  provider.reset()
  const modeResponse = await page.request.post('http://127.0.0.1:31841/fault')
  expect(modeResponse.ok()).toBe(true)

  const discoveryResponse = await page.request.get(
    `${provider.origin}/.well-known/openid-configuration`,
  )
  expect(discoveryResponse.ok()).toBe(true)
  const discovery = await discoveryResponse.json()
  expect(discovery).toMatchObject({
    issuer: provider.origin,
    jwks_uri: `${provider.origin}/jwks`,
  })

  const jwksResponse = await page.request.get(discovery.jwks_uri)
  expect(jwksResponse.ok()).toBe(true)
  const jwks = await jwksResponse.json()
  expect(jwks.keys).toEqual([
    expect.objectContaining({
      alg: 'ES256',
      kid: 'offline-signing-key',
      kty: 'EC',
      use: 'sig',
    }),
  ])

  await page.goto(`${appOrigin}/auth/oidc/login`)
  await page.waitForURL(`${appOrigin}/`)

  await expect(page.locator('div[name="userName"]')).toHaveText('first-user')
  await expect(page.locator('div[name="claims"]')).toContainText('admin-role')
  await expect(page.locator('div[name="userInfo"]')).toContainText('First User')

  await page.context().request.post(`${appOrigin}/api/test/session-stale`)
  await page.click('button[name="refresh"]')
  await expect(page.locator('div[name="userName"]')).toHaveText('first-user')
  await expect(page.locator('div[name="claims"]')).toContainText('user-role')
  await expect(page.locator('div[name="claims"]')).not.toContainText('admin-role')

  await page.goto(`${appOrigin}/auth/login`)
  const { releaseTokenRequest, tokenRequestReached } = provider.blockNextTokenRequest()

  await page.click('button[name="oidc"]', { noWaitAfter: true })
  await tokenRequestReached

  let staleTab: Page | undefined
  try {
    staleTab = await page.context().newPage()
    await staleTab.goto(`${appOrigin}/auth/oidc/callback`)
    await expect(staleTab.locator('div[name="loggedIn"]')).toHaveText('true')
    await expect(staleTab.locator('div[name="userName"]')).toHaveText('first-user')
  } finally {
    releaseTokenRequest()
    await staleTab?.close()
  }
  await page.waitForURL(`${appOrigin}/`)

  await expect(page.locator('div[name="userName"]')).toHaveText('second-user')
  await expect(page.locator('div[name="userInfo"]')).toHaveText('')

  await page.goto(
    `${appOrigin}/auth/oidc/logout?logoutRedirectUri=${encodeURIComponent(logoutRedirectTarget)}`,
  )

  expect(provider.getLastLogoutRedirect()).toBe(logoutRedirectTarget)
  expect(page.url()).toBe(expectedLogoutRedirect)
})

const rejectedTokenFaults: TokenFault[] = [
  'invalid-signature',
  'issuer-mismatch',
  'audience-mismatch',
  'nonce-mismatch',
]

for (const fault of rejectedTokenFaults) {
  test(`rejects ${fault} in strict mode`, async ({ page }) => {
    provider.reset()
    provider.setTokenFault(fault)
    const modeResponse = await page.request.post('http://127.0.0.1:31841/fault')
    expect(modeResponse.ok()).toBe(true)

    await page.goto(`${appOrigin}/auth/oidc/login`)
    await page.waitForURL(`${appOrigin}/auth/login?callbackRedirectUrl=/`)

    const sessionResponse = await page.request.get(`${appOrigin}/api/_auth/session`)
    expect(sessionResponse.ok()).toBe(true)
    expect(await sessionResponse.json()).toEqual({})
    expect(provider.getTokenRequestCount()).toBe(1)
  })
}
