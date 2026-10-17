import { defineNuxtConfig } from 'nuxt/config'

import nuxtOidcAuth from '../../../src/module'

export default defineNuxtConfig({
  modules: [nuxtOidcAuth],

  // The DevTools secrets test enables DevTools, its authorization and dev mode for a spawned dev server.
  devtools: {
    enabled: process.env['NUXT_OIDC_TEST_DEVTOOLS'] === 'true',
    ...(process.env['NUXT_OIDC_TEST_DEVTOOLS_DISABLE_AUTHORIZATION'] === 'true'
      ? { disableAuthorization: true }
      : {}),
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
      enabled: process.env['NUXT_OIDC_TEST_DEV_MODE'] !== 'false',
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
