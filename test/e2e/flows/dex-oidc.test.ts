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
  // Signed-out pages start a new login, which waits at the provider and keeps the logged-out state
  // observable. Playwright cannot hold redirects, so let it arrive before the next navigation.
  const logOut = async (navigate: () => Promise<void>) => {
    await navigate()
    await page.waitForURL(dexAuthorization)
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

test('keeps a login in progress when another site requests login and callback in the background', async ({
  context,
  page,
}) => {
  const login = `${appOrigin}/auth/oidc/login**`
  const heldLogin = Promise.withResolvers<() => Promise<void>>()
  // Holds the login after its handler stored the transaction cookie, before the browser follows the
  // redirect to the provider
  await page.route(login, async (route) => {
    const response = await route.fetch({ maxRedirects: 0 })
    // The browser context already stored the cookie; repeating it would undo a replacement
    const headers = Object.fromEntries(
      Object.entries(response.headers()).filter(([name]) => name !== 'set-cookie'),
    )
    heldLogin.resolve(async () => {
      await route.fulfill({ response, headers })
    })
  })
  await page.goto(`${appOrigin}/auth/login`)
  // The click waits for the login navigation, which stays held until it is released
  const loginClick = page.click('button[name="oidc"]')
  const releaseLogin = await heldLogin.promise
  expect((await context.cookies()).map(({ name }) => name)).toContain('__Host-oidc')

  // A page of another site on a local address, since Chrome blocks requests from public to local ones
  const attacker = await context.newPage()
  await attacker.goto('http://127.0.0.1:5556/dex/.well-known/openid-configuration')
  await attacker.evaluate(async (origin) => {
    const paths = ['/auth/oidc/login', '/auth/oidc/callback?code=forged&state=forged']
    const requests = paths.map(async (path) => {
      const image = new Image()
      const settled = new Promise<void>((resolve) => {
        image.addEventListener('load', () => {
          resolve()
        })
        image.addEventListener('error', () => {
          resolve()
        })
      })
      image.src = `${origin}${path}`
      await settled
    })
    await Promise.all(requests)
  }, appOrigin)
  await attacker.close()

  await releaseLogin()
  await page.unroute(login)
  await loginClick
  await page.waitForURL(`${appOrigin}/`)
  await expect(page.locator('div[name="loggedIn"]')).toHaveText('true')
})
