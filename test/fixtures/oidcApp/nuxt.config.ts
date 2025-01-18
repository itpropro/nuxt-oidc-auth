import { defineNuxtConfig } from 'nuxt/config'
import nuxtOidcAuth from '../../../src/module'

export default defineNuxtConfig({
  modules: [
    nuxtOidcAuth,
  ],

  telemetry: {
    enabled: false,
  },

  oidc: {
    defaultProvider: 'keycloak',
    providers: {
      keycloak: {
        audience: 'account',
        clientId: '',
        clientSecret: '',
        baseUrl: 'http://localhost:8080/realms/nuxt-oidc-test',
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
    enabled: true,
  },

  imports: {
    autoImport: true,
  },

  nitro: {
    preset: 'node-server',
    storage: { // Local file system storage for demo purposes
      oidc: {
        driver: 'fs',
        base: 'playground/oidcstorage',
      },
    },
  },

  compatibilityDate: '2024-08-28',
})
