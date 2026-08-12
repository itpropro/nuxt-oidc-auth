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
      keycloak: {
        baseUrl: '',
        clientId: '',
        clientSecret: '',
        redirectUri: '',
      },
      auth0: {
        baseUrl: '',
        clientId: '',
        clientSecret: '',
        redirectUri: '',
      },
      github: {
        clientId: 'static-client',
        clientSecret: 'static-secret',
        redirectUri: 'https://app.example.test/auth/github/callback',
      },
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
