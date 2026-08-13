import type { ProviderConfigs } from '../../src/runtime/types'
import type { TestProviderConfig } from '../setup/types'

const appOrigin = process.env.NUXT_OIDC_TEST_APP_ORIGIN || 'http://localhost:31840'
const callback = (provider: string) => `${appOrigin}/auth/${provider}/callback`
const entraTenantId = process.env.NUXT_OIDC_PROVIDERS_ENTRA_TENANT_ID || ''

export const automatedProviderOptions = {
  apple: {
    allowedCallbackRedirectUrls: [appOrigin],
    clientId: process.env.NUXT_OIDC_PROVIDERS_APPLE_CLIENT_ID || '',
    clientSecret: process.env.NUXT_OIDC_PROVIDERS_APPLE_CLIENT_SECRET || '',
    redirectUri: callback('apple'),
  },
  auth0: {
    allowedCallbackRedirectUrls: [appOrigin],
    baseUrl: process.env.NUXT_OIDC_PROVIDERS_AUTH0_BASE_URL || '',
    clientId: process.env.NUXT_OIDC_PROVIDERS_AUTH0_CLIENT_ID || '',
    clientSecret: process.env.NUXT_OIDC_PROVIDERS_AUTH0_CLIENT_SECRET || '',
    redirectUri: 'http://localhost:3000/auth/auth0/callback',
    scope: ['openid', 'profile', 'email', 'offline_access'],
  },
  cognito: {
    allowedCallbackRedirectUrls: [appOrigin],
    baseUrl: process.env.NUXT_OIDC_PROVIDERS_COGNITO_BASE_URL || '',
    clientId: process.env.NUXT_OIDC_PROVIDERS_COGNITO_CLIENT_ID || '',
    clientSecret: process.env.NUXT_OIDC_PROVIDERS_COGNITO_CLIENT_SECRET || '',
    logoutRedirectUri: appOrigin,
    redirectUri: callback('cognito'),
    scope: ['openid', 'email', 'profile'],
  },
  entra: {
    allowedCallbackRedirectUrls: [appOrigin],
    authorizationUrl: `https://login.microsoftonline.com/${entraTenantId}/oauth2/v2.0/authorize`,
    clientId: process.env.NUXT_OIDC_PROVIDERS_ENTRA_CLIENT_ID || '',
    clientSecret: process.env.NUXT_OIDC_PROVIDERS_ENTRA_CLIENT_SECRET || '',
    redirectUri: callback('entra'),
    tokenUrl: `https://login.microsoftonline.com/${entraTenantId}/oauth2/v2.0/token`,
  },
  github: {
    allowedCallbackRedirectUrls: [appOrigin],
    clientId: process.env.NUXT_OIDC_PROVIDERS_GITHUB_CLIENT_ID || '',
    clientSecret: process.env.NUXT_OIDC_PROVIDERS_GITHUB_CLIENT_SECRET || '',
    redirectUri: callback('github'),
  },
  logto: {
    allowedCallbackRedirectUrls: [appOrigin],
    baseUrl: process.env.NUXT_OIDC_PROVIDERS_LOGTO_BASE_URL || '',
    clientId: process.env.NUXT_OIDC_PROVIDERS_LOGTO_CLIENT_ID || '',
    clientSecret: process.env.NUXT_OIDC_PROVIDERS_LOGTO_CLIENT_SECRET || '',
    logoutRedirectUri: appOrigin,
    redirectUri: callback('logto'),
  },
  microsoft: {
    allowedCallbackRedirectUrls: [appOrigin],
    clientId: process.env.NUXT_OIDC_PROVIDERS_MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.NUXT_OIDC_PROVIDERS_MICROSOFT_CLIENT_SECRET || '',
    redirectUri: callback('microsoft'),
  },
  oidc: {
    allowedCallbackRedirectUrls: [appOrigin],
    audience: 'nuxt-oidc-test',
    authorizationUrl: 'http://127.0.0.1:5556/dex/auth/mock',
    clientId: 'nuxt-oidc-test',
    clientSecret: 'nuxt-oidc-test-secret',
    logoutUrl: 'http://127.0.0.1:5556/dex/auth',
    nonce: true,
    openIdConfiguration: {
      issuer: 'http://127.0.0.1:5556/dex',
      jwks_uri: 'http://127.0.0.1:5556/dex/keys',
    },
    optionalClaims: ['resource_access'],
    pkce: true,
    redirectUri: callback('oidc'),
    scope: ['openid', 'profile', 'email', 'offline_access'],
    tokenRequestType: 'form-urlencoded',
    tokenUrl: 'http://127.0.0.1:5556/dex/token',
    tokenValidationMode: 'strict',
    userInfoUrl: 'http://127.0.0.1:5556/dex/userinfo',
    userNameClaim: 'name',
    logoutRedirectParameterName: 'post_logout_redirect_uri',
    validateAccessToken: true,
    validateIdToken: true,
  },
  paypal: {
    allowedCallbackRedirectUrls: [appOrigin],
    authorizationUrl: 'https://www.sandbox.paypal.com/signin/authorize?flowEntry=static',
    clientId: process.env.NUXT_OIDC_PROVIDERS_PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.NUXT_OIDC_PROVIDERS_PAYPAL_CLIENT_SECRET || '',
    redirectUri: callback('paypal'),
    scope: ['openid', 'profile'],
    tokenUrl: 'https://api-m.sandbox.paypal.com/v1/oauth2/token',
    userInfoUrl:
      'https://api-m.sandbox.paypal.com/v1/identity/openidconnect/userinfo?schema=openid',
  },
  zitadel: {
    allowedCallbackRedirectUrls: [appOrigin],
    authenticationScheme: 'none',
    baseUrl: process.env.NUXT_OIDC_PROVIDERS_ZITADEL_BASE_URL || '',
    clientId: process.env.NUXT_OIDC_PROVIDERS_ZITADEL_CLIENT_ID || '',
    clientSecret: process.env.NUXT_OIDC_PROVIDERS_ZITADEL_CLIENT_SECRET || '',
    logoutRedirectUri: appOrigin,
    redirectUri: callback('zitadel'),
  },
} satisfies Partial<ProviderConfigs>

export const providerConfigs: readonly TestProviderConfig[] = [
  {
    name: 'oidc',
    requiredEnvVars: [],
    mode: 'dex',
    authorizationUrlPattern: /^http:\/\/127\.0\.0\.1:5556\/dex\/auth\/mock$/,
    capabilities: {
      fullLogin: true,
      refresh: true,
      singleSignOut: false,
      logoutRedirect: false,
    },
    config: automatedProviderOptions.oidc,
  },
  {
    name: 'apple',
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_APPLE_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_APPLE_CLIENT_SECRET',
    ],
    mode: 'online',
    authorizationUrlPattern: /^https:\/\/appleid\.apple\.com\/auth\/oauth2\/v2\/authorize$/,
    capabilities: {
      fullLogin: false,
      refresh: false,
      singleSignOut: false,
      logoutRedirect: false,
    },
    config: automatedProviderOptions.apple,
  },
  {
    name: 'auth0',
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_AUTH0_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_AUTH0_CLIENT_SECRET',
      'NUXT_OIDC_PROVIDERS_AUTH0_BASE_URL',
    ],
    mode: 'online',
    authorizationUrlPattern: /\/authorize$/,
    capabilities: {
      fullLogin: false,
      refresh: true,
      singleSignOut: false,
      logoutRedirect: false,
    },
    loginPage: {
      open: async (page, loginUrl) => {
        await page.goto(loginUrl)
        await page.waitForURL(/auth0\.com/)
      },
      selector: 'input[name="email"], input[name="username"]',
    },
    config: automatedProviderOptions.auth0,
  },
  {
    name: 'cognito',
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_COGNITO_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_COGNITO_CLIENT_SECRET',
      'NUXT_OIDC_PROVIDERS_COGNITO_BASE_URL',
    ],
    mode: 'online',
    authorizationUrlPattern: /\/oauth2\/authorize$/,
    capabilities: {
      fullLogin: false,
      refresh: true,
      singleSignOut: false,
      logoutRedirect: true,
    },
    config: automatedProviderOptions.cognito,
  },
  {
    name: 'entra',
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_ENTRA_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_ENTRA_CLIENT_SECRET',
      'NUXT_OIDC_PROVIDERS_ENTRA_TENANT_ID',
    ],
    mode: 'online',
    authorizationUrlPattern: /login\.microsoftonline\.com\/.+\/oauth2\/v2\.0\/authorize$/,
    capabilities: {
      fullLogin: false,
      refresh: true,
      singleSignOut: false,
      logoutRedirect: true,
    },
    config: automatedProviderOptions.entra,
  },
  {
    name: 'github',
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_GITHUB_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_GITHUB_CLIENT_SECRET',
    ],
    mode: 'online',
    authorizationUrlPattern: /^https:\/\/github\.com\/login\/oauth\/authorize$/,
    capabilities: {
      fullLogin: false,
      refresh: false,
      singleSignOut: false,
      logoutRedirect: false,
    },
    config: automatedProviderOptions.github,
  },
  {
    name: 'logto',
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_LOGTO_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_LOGTO_CLIENT_SECRET',
      'NUXT_OIDC_PROVIDERS_LOGTO_BASE_URL',
    ],
    mode: 'online',
    authorizationUrlPattern: /\/oidc\/auth$/,
    capabilities: {
      fullLogin: false,
      refresh: true,
      singleSignOut: false,
      logoutRedirect: true,
    },
    config: automatedProviderOptions.logto,
  },
  {
    name: 'microsoft',
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_MICROSOFT_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_MICROSOFT_CLIENT_SECRET',
    ],
    mode: 'online',
    authorizationUrlPattern:
      /^https:\/\/login\.microsoftonline\.com\/common\/oauth2\/v2\.0\/authorize$/,
    capabilities: {
      fullLogin: false,
      refresh: true,
      singleSignOut: false,
      logoutRedirect: true,
    },
    config: automatedProviderOptions.microsoft,
  },
  {
    name: 'paypal',
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_PAYPAL_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_PAYPAL_CLIENT_SECRET',
    ],
    mode: 'online',
    authorizationUrlPattern: /^https:\/\/www\.sandbox\.paypal\.com\/signin\/authorize$/,
    capabilities: {
      fullLogin: false,
      refresh: false,
      singleSignOut: false,
      logoutRedirect: false,
    },
    config: automatedProviderOptions.paypal,
  },
  {
    name: 'zitadel',
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_ZITADEL_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_ZITADEL_CLIENT_SECRET',
      'NUXT_OIDC_PROVIDERS_ZITADEL_BASE_URL',
    ],
    mode: 'online',
    authorizationUrlPattern: /\/oauth\/v2\/authorize$/,
    capabilities: {
      fullLogin: false,
      refresh: true,
      singleSignOut: false,
      logoutRedirect: true,
    },
    config: automatedProviderOptions.zitadel,
  },
]

export const providers = providerConfigs.map(({ name }) => name)
