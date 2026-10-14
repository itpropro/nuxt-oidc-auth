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
      'oidc:dev': {
        driver: 'memory',
      },
    },
  },

  telemetry: {
    enabled: false,
  },

  oidc: {
    providers: {
      oidc: {
        clientId: 'dummy',
        clientSecret: 'dummy',
        authorizationUrl: 'http://localhost/auth',
        tokenUrl: 'http://localhost/token',
        redirectUri: 'http://localhost/callback',
      },
    },
    devMode: {
      enabled: true,
      generateAccessToken: true,
      issuer: 'test-issuer',
      audience: 'test-audience',
      subject: 'test-subject',
      claims: {
        role: 'developer',
      },
    },
    session: {
      expirationCheck: false,
      automaticRefresh: false,
    },
    middleware: {
      globalMiddlewareEnabled: false,
    },
  },
})
