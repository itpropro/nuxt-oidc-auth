import type { ProviderKeys } from '../../../src/runtime/types'
import { defineNuxtConfig } from 'nuxt/config'
import nuxtOidcAuth from '../../../src/module'

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
    // Default provider can be overridden via environment
    defaultProvider: (process.env.NUXT_OIDC_DEFAULT_PROVIDER || 'oidc') as ProviderKeys,
    providers: {
      oidc: {
        clientId: 'nuxt-oidc-test',
        clientSecret: 'nuxt-oidc-test-secret',
        audience: 'nuxt-oidc-test',
        authorizationUrl: 'http://127.0.0.1:5556/dex/auth/mock',
        tokenUrl: 'http://127.0.0.1:5556/dex/token',
        userInfoUrl: 'http://127.0.0.1:5556/dex/userinfo',
        logoutUrl: 'http://127.0.0.1:5556/dex/auth',
        openIdConfiguration: {
          issuer: 'http://127.0.0.1:5556/dex',
          jwks_uri: 'http://127.0.0.1:5556/dex/keys',
        },
        redirectUri:
          process.env.NUXT_OIDC_PROVIDERS_OIDC_REDIRECT_URI ||
          'http://localhost:3000/auth/oidc/callback',
        scope: ['openid', 'profile', 'email', 'offline_access'],
        userNameClaim: 'name',
        optionalClaims: ['resource_access'],
        logoutRedirectParameterName: 'post_logout_redirect_uri',
        tokenRequestType: 'form-urlencoded',
        pkce: true,
        nonce: true,
        tokenValidationMode: 'strict',
        validateAccessToken: true,
        validateIdToken: true,
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
