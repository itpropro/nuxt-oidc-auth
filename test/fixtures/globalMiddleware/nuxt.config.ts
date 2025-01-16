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
        clientId: 'b12150fb-cf41-4fa8-a941-454211772f01',
        clientSecret: 'vA9pmI6Pab84bjd2aPnXiS8n6FAcsGfk',
        baseUrl: 'http://localhost:8080/realms/nuxt-oidc-test',
        redirectUri: 'http://localhost:3000/auth/keycloak/callback',
        userNameClaim: 'preferred_username',
        logoutRedirectUri: 'http://localhost:3000',
        // For testing Single sign-out
        sessionConfiguration: {
          singleSignOut: true,
        },
      },
    },
    middleware: {
      globalMiddlewareEnabled: true,
      customLoginPage: false,
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
