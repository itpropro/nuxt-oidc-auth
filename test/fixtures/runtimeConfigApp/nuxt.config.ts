import { defineNuxtConfig } from 'nuxt/config'
import nuxtOidcAuth from '../../../src/module'

export default defineNuxtConfig({
  modules: [nuxtOidcAuth],

  telemetry: {
    enabled: false,
  },

  oidc: {
    defaultProvider: 'keycloak',
    providers: {
      auth0: {},
      cognito: {},
      github: {
        clientId: 'static-client',
        clientSecret: 'static-secret',
        redirectUri: 'https://app.example.test/auth/github/callback',
      },
      keycloak: {},
      logto: {},
      oidc: {
        authorizationUrl: 'authorize',
        tokenUrl: 'token',
      },
      zitadel: {},
    },
    middleware: {
      globalMiddlewareEnabled: false,
    },
    provideDefaultSecrets: false,
  },

  devtools: {
    enabled: false,
  },

  nitro: {
    preset: 'node-server',
    storage: {
      oidc: {
        driver: 'memory',
      },
    },
  },

  compatibilityDate: '2024-08-28',
})
