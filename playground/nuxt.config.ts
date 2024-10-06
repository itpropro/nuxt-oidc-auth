import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  modules: [
    'nuxt-oidc-auth',
    '@unocss/nuxt',
    '@nuxtjs/color-mode',
  ],

  telemetry: false,

  oidc: {
    defaultProvider: 'github',
    providers: {
      entra: {
        redirectUri: 'http://localhost:3000/auth/entra/callback',
        clientId: '',
        clientSecret: '',
        authorizationUrl: 'https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token',
        userNameClaim: 'unique_name',
        nonce: true,
        responseType: 'code id_token',
        scope: ['profile', 'openid', 'offline_access', 'email'],
        logoutUrl: '',
        optionalClaims: ['unique_name', 'family_name', 'given_name', 'login_hint'],
        audience: '',
        additionalAuthParameters: {
          resource: '',
          prompt: 'select_account',
        },
        additionalLogoutParameters: {
          logoutHint: '',
        },
        allowedClientAuthParameters: [
          'test',
        ],
        validateAccessToken: true,
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
    },
    session: {
      expirationCheck: true,
      automaticRefresh: true,
      expirationThreshold: 3600,
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

  devtools: { enabled: true },

  imports: {
    autoImport: true,
  },

  nitro: {
    preset: 'node-server',
    storage: { // Local file system storage for demo purposes
      oidc: {
        driver: 'fs',
        base: 'playground/oidcstorage',
      },
    },
  },

  compatibilityDate: '2024-08-28',
})
