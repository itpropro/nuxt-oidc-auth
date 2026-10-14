import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

const origin = 'http://127.0.0.1:4173'
const logtoOption = /^LogtoLogto provider/u

function monitorPage(page: Page) {
  const errors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`))
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).origin === origin) {
      errors.push(
        `request: ${request.method()} ${request.url()} ${request.failure()?.errorText ?? ''}`,
      )
    }
  })
  page.on('response', (response) => {
    if (new URL(response.url()).origin === origin && response.status() >= 400) {
      errors.push(`response: ${response.status()} ${response.url()}`)
    }
  })

  return async () => {
    await page.waitForTimeout(100)
    expect(errors, errors.join('\n')).toEqual([])
  }
}

const routes = [
  { path: '/', heading: 'Nuxt OIDC Auth' },
  { path: '/configuration', heading: 'Configuration reference' },
  { path: '/getting-started/security', heading: 'Security' },
  { path: '/provider/logto', heading: 'Logto' },
]

test('generated docs render direct routes and client navigation', async ({ page }) => {
  const assertClean = monitorPage(page)
  for (const route of routes) {
    // oxlint-disable-next-line no-await-in-loop -- Direct route checks share one page and must finish before the next navigation.
    const response = await page.goto(route.path)
    expect(response?.ok(), `${route.path} returned ${response?.status()}`).toBe(true)
    // oxlint-disable-next-line no-await-in-loop -- Verify the current route before the shared page navigates again.
    await expect(page.getByRole('heading', { level: 1 })).toContainText(route.heading)
  }
  await page.goto('/')
  await page.getByRole('button', { name: 'Search…' }).first().click()
  await page.getByRole('textbox', { name: 'Type a command or search…' }).fill('Logto')
  await page.getByRole('option', { name: logtoOption }).click()
  await expect(page).toHaveURL(`${origin}/provider/logto`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Logto')

  await page.getByRole('link', { name: 'Configuration reference', exact: true }).first().click()
  await expect(page).toHaveURL(`${origin}/configuration`)
  await page.getByRole('link', { name: 'Security', exact: true }).first().click()
  await expect(page).toHaveURL(`${origin}/getting-started/security`)

  const changelogLink = page.getByRole('link', { name: 'Changelog', exact: true }).first()
  await expect(changelogLink).toHaveAttribute(
    'href',
    'https://github.com/itpropro/nuxt-oidc-auth/blob/main/CHANGELOG.md',
  )
  await expect(changelogLink).toHaveAttribute('target', '_blank')
  await assertClean()
})

test('image popups close and reopen through their controls', async ({ page }) => {
  const assertClean = monitorPage(page)
  await page.goto('/provider/auth0')
  const imageButton = page.getByRole('button').filter({
    has: page.getByRole('img', { name: 'Auth0 grant config', exact: true }),
  })
  const closeButton = page.getByRole('button', { name: 'Close', exact: true })

  await imageButton.click()
  await expect(closeButton).toBeVisible()
  await closeButton.click()
  await expect(closeButton).toBeHidden()

  await imageButton.click()
  await expect(closeButton).toBeVisible()
  await page.locator('[popover]:popover-open').click({ position: { x: 5, y: 5 } })
  await expect(closeButton).toBeHidden()
  await assertClean()
})
