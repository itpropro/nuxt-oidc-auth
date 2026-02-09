import { url } from '@nuxt/test-utils/e2e'
import { expect } from '@nuxt/test-utils/playwright'

export async function signInWithKeycloak(page: any, goto: any) {
  await goto(url('/auth/login'))
  await page.click('button[name="keycloak"]')
  await page.fill('input[name="username"]', 'testuser')
  await page.fill('input[name="password"]', 'p@ssword')
  await page.click('input[name="login"]')
  await page.waitForURL(url('/'))
}

export async function removePersistentSession(page: any) {
  const response = await page.request.post(url('/api/test/oidc-storage-clear'))
  expect(response.ok()).toBe(true)
}
