import { url } from '@nuxt/test-utils/e2e'
import { expect } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'

export async function signInWithKeycloak(page: Page, goto: (path: string) => Promise<unknown>) {
  await goto(url('/auth/keycloak/login'))
  await page.fill('input[name="username"]', 'testuser')
  await page.fill('input[name="password"]', 'p@ssword')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL(url('/'))
}

export async function removePersistentSession(page: any) {
  const response = await page.request.post(url('/api/test/oidc-storage-clear'))
  expect(response.ok()).toBe(true)
}
