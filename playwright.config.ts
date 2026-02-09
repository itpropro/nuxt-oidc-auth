import type { ConfigOptions } from '@nuxt/test-utils/playwright'
import { defineConfig, devices } from '@playwright/test'
import { isCI } from 'std-env'

const chromiumProjectUse = {
  ...devices['Desktop Chrome'],
  channel: undefined,
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  },
}

/* See https://playwright.dev/docs/test-configuration. */
export default defineConfig<ConfigOptions>({
  testIgnore: ['**/utils.test.ts', '**/unit/**', '**/functional/**'],
  testDir: './test/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!isCI,
  /* Retry on CI only */
  retries: isCI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: isCI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: chromiumProjectUse,
    },
  ],
})
