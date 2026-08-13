import { defineNuxtConfig } from 'nuxt/config'
import nuxtOidcAuth from '../../../src/module'
import { automatedProviderOptions } from '../providers'

/**
 * Test fixture Nuxt configuration
 *
 * This app is used for E2E testing of the OIDC authentication flows.
 * It supports both:
 * - Local dex (for offline/generic OIDC tests)
 * - Real providers when configured by provider-specific tests
 */
export default defineNuxtConfig({
  modules: [nuxtOidcAuth],

  telemetry: {
    enabled: false,
  },

  oidc: {
    defaultProvider: 'oidc',
    providers: automatedProviderOptions,
    middleware: {
      globalMiddlewareEnabled: true,
      customLoginPage: true,
    },
  },

  devtools: {
    enabled: false, // Disabled for testing
  },

  imports: {
    autoImport: true,
  },

  nitro: {
    preset: 'node-server',
    storage: {
      // Use memory storage for tests to ensure isolation
      oidc: {
        driver: 'memory',
      },
    },
  },

  compatibilityDate: '2024-08-28',
})
