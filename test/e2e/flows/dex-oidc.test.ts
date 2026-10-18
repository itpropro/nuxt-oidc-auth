import { expect, test } from '@nuxt/test-utils/playwright'

const appOrigin = 'http://localhost:31840'
const dexAuthorization = 'http://127.0.0.1:5556/dex/auth**'

test('completes a validated generic OIDC session and refresh against dex', async ({ page }) => {
  await page.goto(`${appOrigin}/auth/login`)
  await page.click('button[name="oidc"]')
  await page.waitForURL(`${appOrigin}/`)

  await expect(page.locator('div[name="loggedIn"]')).toHaveText('true')
  await expect(page.locator('div[name="currentProvider"]')).toHaveText('oidc')
  await expect(page.locator('div[name="userName"]')).toHaveText('Kilgore Trout')
  await expect(page.locator('div[name="userInfo"]')).toContainText('kilgore@kilgore.trout')
  await expect(page.locator('div[name="canRefresh"]')).toHaveText('true')

  const refreshResponse = await page.context().request.post(`${appOrigin}/api/_auth/refresh`)
  expect(refreshResponse.ok()).toBe(true)

  await page.reload()
  await expect(page.locator('div[name="loggedIn"]')).toHaveText('true')
})

test('ignores cross-site logout navigations and keeps same-origin logout working', async ({
  page,
}) => {
  const signIn = async () => {
    await page.goto(`${appOrigin}/auth/login`)
    await page.click('button[name="oidc"]')
    await page.waitForURL(`${appOrigin}/`)
    await expect(page.locator('div[name="loggedIn"]')).toHaveText('true')
  }
  const session = async (): Promise<unknown> => {
    const response = await page.context().request.get(`${appOrigin}/api/_auth/session`)
    return await response.json()
  }
  // Signed-out pages start a new login; stopping it there keeps the logged-out state observable
  const logOut = async (navigate: () => Promise<void>) => {
    await page.route(dexAuthorization, async (route) => {
      await route.abort()
    })
    const loginRedirect = page.waitForRequest(dexAuthorization)
    await navigate()
    await loginRedirect
    await page.unroute(dexAuthorization)
    await expect(session()).resolves.toStrictEqual({})
  }
  await page.route('http://attacker.test/', async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      body: `<script>location.href = '${appOrigin}/auth/logout'</script>`,
    })
  })

  await signIn()
  const crossSiteLogout = page.waitForRequest(`${appOrigin}/auth/logout`)
  await page.goto('http://attacker.test/')
  // The browser still sends the session cookie, so only the cross-site check keeps the session.
  // Playwright reports intercepted requests without the Sec-Fetch headers Chrome adds later.
  const crossSiteHeaders = await (await crossSiteLogout).allHeaders()
  expect(crossSiteHeaders['cookie']).toContain('nuxt-oidc-auth=')
  await page.waitForURL(`${appOrigin}/`)
  await expect(page.locator('div[name="loggedIn"]')).toHaveText('true')
  await expect(session()).resolves.toMatchObject({ provider: 'oidc' })

  await logOut(async () => {
    await page.evaluate(() => {
      location.href = '/auth/logout'
    })
  })

  await signIn()
  await logOut(async () => {
    await page.click('button[name="logout"]')
  })
})
