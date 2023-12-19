import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  extends: ['@nuxt/ui-pro'],
  modules: [
    '../src/module',
    '@nuxt/ui'
   ],
  oidc: {
    providers: {
      entra: {
        redirectUri: 'http://localhost:3000/auth/entra/callback',
        clientId: 'SECRET',
        clientSecret: 'SECRET',
        authorizationUrl: 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token',
        userNameClaim: 'name',
        nonce: true,
        responseType: 'code id_token',
        scope: ['profile', 'openid', 'offline_access', 'email'],
        logoutUrl: '' // 'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
      },
      auth0: {
        responseType: 'code',
        redirectUri: 'http://localhost:3000/auth/auth0/callback',
        baseUrl: 'SECRET',
        clientId: 'SECRET',
        clientSecret: 'SECRET',
        scope: ['offline_access', 'profile', 'email'],
        additionalTokenParameters: {
          audience: 'test-api-oidc'
        },
        additionalAuthParameters: {
          audience: 'test-api-oidc'
        }
      }
    },
    session: {
      refreshTokenSecret: 'SECRET', // Base 64 encoded exportKey('raw', subtle.generateKey({name: "AES-GCM", length: 256, }, true, ["encrypt", "decrypt"]))
    }
  },
  devtools: { enabled: true },
  imports: {
    autoImport: true
  },
  nitro: {
    storage: { // User different driver for persistant storage
      oidc: {
        driver: 'memory'
      }
    }
  }
})
