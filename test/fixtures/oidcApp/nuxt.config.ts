import type { ProviderKeys } from '../../../src/runtime/types'
import { defineNuxtConfig } from 'nuxt/config'
import nuxtOidcAuth from '../../../src/module'

/**
 * Test fixture Nuxt configuration
 *
 * This app is used for E2E testing of the OIDC authentication flows.
 * It supports both:
 * - Mock OIDC provider (for offline/generic OIDC tests)
 * - Real providers (Keycloak, Auth0, etc.) when configured
 */
export default defineNuxtConfig({
  modules: [
    nuxtOidcAuth,
  ],

  telemetry: {
    enabled: false,
  },

  oidc: {
    // Default provider can be overridden via environment
    defaultProvider: (process.env.NUXT_OIDC_DEFAULT_PROVIDER || 'keycloak') as ProviderKeys,
    providers: {
      // Generic OIDC provider for offline testing with mock server
      oidc: {
        clientId: 'mock-client',
        clientSecret: 'mock-secret',
        authorizationUrl: 'http://localhost:3000/mock-oidc/authorize',
        tokenUrl: 'http://localhost:3000/mock-oidc/token',
        userInfoUrl: 'http://localhost:3000/mock-oidc/userinfo',
        redirectUri: 'http://localhost:3000/auth/oidc/callback',
        scope: ['openid', 'profile', 'email'],
        pkce: true,
      },
      // Keycloak provider for integration testing (requires running server)
      keycloak: {
        audience: 'account',
        clientId: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_ID || '',
        clientSecret: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_SECRET || '',
        baseUrl: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_BASE_URL || 'http://localhost:8080/realms/nuxt-oidc-test',
        redirectUri: 'http://localhost:3000/auth/keycloak/callback',
        userNameClaim: 'preferred_username',
        allowedCallbackRedirectUrls: [
          'http://localhost',
          'http://127.0.0.1',
        ],
        sessionConfiguration: {
          singleSignOut: true,
        },
      },
    },
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
