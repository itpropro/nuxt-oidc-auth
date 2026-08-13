import { expect, test } from '@nuxt/test-utils/playwright'

const appOrigin = 'http://localhost:31840'

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
