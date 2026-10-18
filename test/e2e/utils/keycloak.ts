import { url } from '@nuxt/test-utils/e2e'
import { expect } from '@nuxt/test-utils/playwright'
import type { Page } from '@playwright/test'

export async function signInWithKeycloak(page: Page, goto: (path: string) => Promise<unknown>) {
  await goto(url('/auth/keycloak/login'))
  await page.fill('input[name="username"]', 'testuser')
  await page.fill('input[name="password"]', 'p@ssword')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.waitForURL(url('/'))
  // Clicks before hydration do nothing and leave the server-rendered session on the page
  await page.waitForFunction('window.useNuxtApp?.().isHydrating === false')
}

/**
 * Sends a POST request from the page. Playwright's API request context only sends Secure cookies to
 * localhost, so for the 127.0.0.1 test server it would drop the session cookie and store the new
 * session cookie of the response in the browser.
 */
export async function postFromPage(page: Page, path: string) {
  const status = await page.evaluate(
    async (target) => (await fetch(target, { method: 'POST' })).status,
    url(path),
  )
  expect(status).toBe(200)
}

/** Fetches the session through the app and returns the session the server answered with */
export async function fetchSession(page: Page): Promise<unknown> {
  const sessionResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/_auth/session',
  )
  await page.click('button[name="fetch"]')
  const session: unknown = await (await sessionResponse).json()
  return session
}

export async function removePersistentSession(page: Page) {
  await postFromPage(page, '/api/test/oidc-storage-clear')
}
