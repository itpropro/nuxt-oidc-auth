import { defineNuxtConfig } from 'nuxt/config'

import nuxtOidcAuth from '../../../src/module'

export default defineNuxtConfig({
  modules: [nuxtOidcAuth],

  devtools: {
    enabled: false,
  },

  compatibilityDate: '2024-08-28',

  nitro: {
    preset: 'node-server',
    storage: {
      oidc: {
        driver: 'memory',
      },
    },
  },

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
})
