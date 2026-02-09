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
    },
    session: {
      expirationCheck: false,
      automaticRefresh: false,
    },
    middleware: {
      globalMiddlewareEnabled: false,
    },
  },

  devtools: {
    enabled: false,
  },

  nitro: {
    preset: 'node-server',
    storage: {
      'oidc': {
        driver: 'memory',
      },
      'oidc:dev': {
        driver: 'memory',
      },
    },
  },

  compatibilityDate: '2024-08-28',
})
