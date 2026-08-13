import type { ProviderKeys } from '../../../src/runtime/types'
import { defineNuxtConfig } from 'nuxt/config'
import nuxtOidcAuth from '../../../src/module'

/**
 * Test fixture Nuxt configuration
 *
 * This app is used for E2E testing of the OIDC authentication flows.
 * It supports both:
 * - Local dex (for offline/generic OIDC tests)
 * - Real providers (Keycloak, Auth0, etc.) when configured
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
        tokenRequestType: 'form-urlencoded',
        pkce: true,
        nonce: true,
        tokenValidationMode: 'strict',
        validateAccessToken: true,
        validateIdToken: true,
      },
      keycloak: {
        audience: 'account',
        authorizationUrl: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_AUTHORIZATION_URL,
        clientId: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_ID || '',
        clientSecret: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_SECRET || '',
        baseUrl:
          process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_BASE_URL ||
          'http://localhost:8080/realms/nuxt-oidc-test',
        redirectUri: `http://localhost:${process.env.PORT || '3000'}/auth/keycloak/callback`,
        tokenUrl: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_TOKEN_URL,
        userInfoUrl: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_USER_INFO_URL,
        logoutUrl: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_LOGOUT_URL,
        userNameClaim: 'preferred_username',
        allowedCallbackRedirectUrls: ['http://localhost', 'http://127.0.0.1'],
        optionalClaims: ['resource_access'],
        state: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_STATE === 'true' || undefined,
        pkce: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_PKCE === 'false' ? false : undefined,
        nonce: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_NONCE === 'false' ? false : undefined,
        validateAccessToken:
          process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_VALIDATE_ACCESS_TOKEN === 'false'
            ? false
            : undefined,
        validateIdToken:
          process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_VALIDATE_ID_TOKEN === 'false'
            ? false
            : undefined,
        sessionConfiguration: {
          singleSignOut: process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_SINGLE_SIGN_OUT !== 'false',
          expirationCheck:
            process.env.NUXT_OIDC_PROVIDERS_KEYCLOAK_EXPIRATION_CHECK === 'false'
              ? false
              : undefined,
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
