import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: [
    'nuxt-oidc-auth',
    '@unocss/nuxt',
    '@nuxtjs/color-mode',
  ],
  features: {
    inlineStyles: false,
  },
  oidc: {
    defaultProvider: 'github',
    providers: {
      entra: {
        redirectUri: 'http://localhost:3000/auth/entra/callback',
        clientId: '',
        clientSecret: '',
        authorizationUrl: 'https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token',
        userNameClaim: 'name',
        nonce: true,
        responseType: 'code id_token',
        scope: ['profile', 'openid', 'offline_access', 'email'],
        logoutUrl: '',
        optionalClaims: ['unique_name', 'family_name', 'given_name'],
        additionalAuthParameters: {
          resource: '',
          prompt: 'select_account',
        },
        validateAccessToken: false,
        validateIdToken: true,
      },
      auth0: {
        audience: 'test-api-oidc',
        responseType: 'code',
        redirectUri: 'http://localhost:3000/auth/auth0/callback',
        baseUrl: '',
        clientId: '',
        clientSecret: '',
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
        clientId: '',
        clientSecret: '',
        filterUserinfo: ['login', 'id', 'avatar_url', 'name', 'email'],
      },
      keycloak: {
        audience: 'account',
        baseUrl: '',
        clientId: '',
        clientSecret: '',
        redirectUri: 'http://localhost:3000/auth/keycloak/callback',
      }
    },
    session: {
      expirationCheck: true,
      automaticRefresh: true,
      expirationThreshold: 3600,
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
    preset: 'azure',
    storage: { // Local file system storage for demo purposes
      oidc: {
        driver: 'fs',
        base: 'playground/oidcstorage'
      }
    }
  },
})
