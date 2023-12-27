import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: [
    '@itpropro/nuxt-oidc-auth',
    '@unocss/nuxt',
    '@nuxtjs/color-mode',
  ],
  oidc: {
    defaultProvider: 'github',
    providers: {
      entra: {
        redirectUri: 'http://localhost:3000/auth/entra/callback',
        clientId: '5b3cef9d-9042-44aa-a97f-44d3d181d6cd',
        clientSecret: 'vYP8Q~6NI1eff2nF21jegcBp1GqE804h0pWNicWL',
        authorizationUrl: 'https://login.microsoftonline.com/a1d4d77f-88fb-48cf-88e4-ffc9e13adaf2/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/a1d4d77f-88fb-48cf-88e4-ffc9e13adaf2/oauth2/v2.0/token',
        userNameClaim: 'name',
        nonce: true,
        responseType: 'code id_token',
        scope: ['profile', 'openid', 'offline_access', 'email'],
        logoutUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/logout',
        optionalClaims: ['preferred_username', 'email'],
      },
      auth0: {
        audience: 'test-api-oidc',
        responseType: 'code',
        redirectUri: 'http://localhost:3000/auth/auth0/callback',
        baseUrl: 'BASE_URL',
        clientId: 'CLIENT_ID',
        clientSecret: 'CLIENT_SECRET',
        scope: ['openid', 'offline_access', 'profile', 'email'],
        additionalTokenParameters: {
          audience: 'test-api-oidc'
        },
        additionalAuthParameters: {
          audience: 'test-api-oidc'
        }
      },
      github: {
        redirectUri: 'http://localhost:3000/auth/github/callback',
        clientId: 'CLIENT_ID',
        clientSecret: 'CLIENT_SECRET',
        filterUserinfo: ['login', 'id', 'avatar_url', 'name', 'email'],
      }
    },
    session: {
      expirationCheck: true,
      automaticRefresh: true,
    },
    middleware: {
      globalMiddlewareEnabled: true,
      customLoginPage: true,
    }
  },
  colorMode: {
    classSuffix: '',
    preference: 'dark',
  },
  unocss: {
    preflight: true,
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
