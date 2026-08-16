import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH

if (existsSync('/etc/NIXOS') && !executablePath) {
  throw new Error('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH must point to a Nix-wrapped Chrome or Chromium binary on NixOS')
}

export default defineConfig({
  testDir: './test',
  testMatch: '*.smoke.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'line',
  outputDir: './test-results',
  webServer: {
    command: 'node test/serve-static.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4173',
    channel: executablePath ? undefined : 'chrome',
    launchOptions: {
      executablePath,
    },
    trace: 'on-first-retry',
  },
})
