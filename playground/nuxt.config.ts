import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: [
    '../src/module',
    '@unocss/nuxt',
    '@nuxtjs/color-mode',
  ],

  telemetry: false,

  oidc: {
    defaultProvider: 'entra',
    providers: {
      entra: {
        redirectUri: '',
        clientId: '',
        clientSecret: '',
        authorizationUrl: '',
        tokenUrl: '',
        audience: '',
        userNameClaim: 'unique_name',
        responseType: 'code id_token',
        scope: ['profile', 'openid', 'offline_access', 'email'],
        logoutUrl: '',
        optionalClaims: ['unique_name', 'family_name', 'given_name', 'email'],
        additionalAuthParameters: {
          resource: '',
          prompt: 'select_account',
        },
        validateAccessToken: true,
        validateIdToken: true,
        exposeAccessToken: true,
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
          audience: 'test-api-oidc',
        },
        additionalAuthParameters: {
          audience: 'test-api-oidc',
        },
      },
      github: {
        redirectUri: 'http://localhost:3000/auth/github/callback',
        clientId: '',
        clientSecret: '',
        filterUserInfo: ['login', 'id', 'avatar_url', 'name', 'email'],
      },
      keycloak: {
        audience: 'account',
        baseUrl: '',
        clientId: '',
        clientSecret: '',
        redirectUri: 'http://localhost:3000/auth/keycloak/callback',
        userNameClaim: 'preferred_username',
        logoutRedirectUri: 'http://localhost:3000',
        // For testing Single sign-out
        sessionConfiguration: {
          singleSignOut: true,
        },
      },
      cognito: {
        clientId: '',
        redirectUri: 'http://localhost:3000/auth/cognito/callback',
        clientSecret: '',
        scope: ['openid', 'email', 'profile'],
        logoutRedirectUri: 'https://google.com',
        baseUrl: '',
        exposeIdToken: true,
      },
      zitadel: {
        clientId: '',
        clientSecret: '', // Works with PKCE and Code flow, just leave empty for PKCE
        redirectUri: 'http://localhost:3000/auth/zitadel/callback',
        baseUrl: '',
        audience: '', // Specify for id token validation, normally same as clientId
        logoutRedirectUri: 'https://google.com', // Needs to be registered in Zitadel portal
        authenticationScheme: 'none', // Set this to 'header' if Code is used instead of PKCE
      },
      paypal: {
        clientId: '',
        clientSecret: '',
        scope: ['openid', 'profile'],
        authorizationUrl: 'https://www.sandbox.paypal.com/signin/authorize?flowEntry=static',
        tokenUrl: 'https://api-m.sandbox.paypal.com/v1/oauth2/token',
        userInfoUrl: 'https://api-m.sandbox.paypal.com/v1/identity/openidconnect/userinfo?schema=openid',
        redirectUri: 'http://127.0.0.1:3000/auth/paypal/callback',
      },
      microsoft: {
        clientId: '',
        clientSecret: '',
        redirectUri: 'http://localhost:3000/auth/microsoft/callback',
      },
      logto: {
        baseUrl: '',
        clientId: '',
        clientSecret: '',
        redirectUri: 'http://localhost:3000/auth/logto/callback',
        logoutRedirectUri: 'http://localhost:3000',
      },
    },
    session: {
      expirationCheck: true,
      automaticRefresh: true,
      expirationThreshold: 1800,
    },
    middleware: {
      globalMiddlewareEnabled: true,
      customLoginPage: true,
    },
    devMode: {
      enabled: false,
      generateAccessToken: true,
      userName: 'Test User',
      userInfo: { providerName: 'test' },
      claims: { customclaim01: 'foo', customclaim02: 'bar' },
      issuer: 'dev-issuer',
      audience: 'dev-app',
      subject: 'dev-user',
    },
  },

  colorMode: {
    classSuffix: '',
    preference: 'dark',
  },

  unocss: {
    preflight: true,
    configFile: 'uno.config.ts',
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
        driver: 'azure-storage-blob',
        base: 'oidcstorage',
        accountName: 'link16sessioncachedev',
        containerName: 'link16sessioncache',
      },
    },
  },

  compatibilityDate: '2024-08-28',
  $development: {
    nitro: {
      preset: 'node-server',
      storage: { // Local file system storage for demo purposes
        oidc: {
          driver: 'fs',
          base: 'playground/oidcstorage',
        },
      },
    },

  },
})
