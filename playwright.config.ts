import type { ConfigOptions } from '@nuxt/test-utils/playwright'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import { isCI } from 'std-env'

const chromiumProjectUse = {
  ...devices['Desktop Chrome'],
  channel: undefined,
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  },
}

const offlineTests = [
  'flows/base-url.test.ts',
  'flows/dex-oidc.test.ts',
  'flows/get-user-session-error-behavior.test.ts',
  'flows/integrated-session.test.ts',
  'flows/middleware-callback-redirect.test.ts',
]

const configVariantTests = [
  'flows/base-url-custom.test.ts',
  'flows/dev-mode-metadata.test.ts',
  'flows/middleware-redirect.test.ts',
  'flows/missing-persistent-session-*.test.ts',
  'flows/runtime-config.test.ts',
]

const providerTests = [
  'flows/sign-in.test.ts',
  'flows/sign-out.test.ts',
  'flows/single-sign-out.test.ts',
  'flows/token-refresh.test.ts',
  'providers/**/*.test.ts',
]

const offlineNuxt = {
  rootDir: fileURLToPath(new URL('./test/fixtures/oidcApp', import.meta.url)),
  build: true,
  port: 3000,
  env: {
    NUXT_OIDC_AUTH_SESSION_SECRET: 'test-auth-session-secret-at-least-48-characters-long',
    NUXT_OIDC_DEFAULT_PROVIDER: 'oidc',
    NUXT_OIDC_PROVIDERS_OIDC_AUDIENCE: 'nuxt-oidc-test',
    NUXT_OIDC_PROVIDERS_OIDC_AUTHORIZATION_URL: 'http://127.0.0.1:5556/dex/auth/mock',
    NUXT_OIDC_PROVIDERS_OIDC_CLIENT_ID: 'nuxt-oidc-test',
    NUXT_OIDC_PROVIDERS_OIDC_CLIENT_SECRET: 'nuxt-oidc-test-secret',
    NUXT_OIDC_PROVIDERS_OIDC_REDIRECT_URI: 'http://localhost:3000/auth/oidc/callback',
    NUXT_OIDC_PROVIDERS_OIDC_TOKEN_URL: 'http://127.0.0.1:5556/dex/token',
    NUXT_OIDC_PROVIDERS_OIDC_USER_INFO_URL: 'http://127.0.0.1:5556/dex/userinfo',
    NUXT_OIDC_SESSION_SECRET: 'test-user-session-secret-at-least-48-characters-long',
    NUXT_OIDC_TOKEN_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
  },
}

/* See https://playwright.dev/docs/test-configuration. */
export default defineConfig<ConfigOptions>({
  webServer: {
    command: 'test/fixtures/dex/run.sh',
    url: 'http://127.0.0.1:5556/dex/.well-known/openid-configuration',
    reuseExistingServer: !isCI,
    timeout: 15_000,
  },
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
      name: 'offline',
      testMatch: offlineTests,
      fullyParallel: false,
      workers: 1,
      use: {
        ...chromiumProjectUse,
        defaults: { nuxt: offlineNuxt },
      },
    },
    {
      name: 'config-variants',
      testMatch: configVariantTests,
      use: chromiumProjectUse,
    },
    {
      name: 'providers',
      testMatch: providerTests,
      use: chromiumProjectUse,
    },
  ],
})
