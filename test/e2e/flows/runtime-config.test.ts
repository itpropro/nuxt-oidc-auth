import { fileURLToPath } from 'node:url'
import { url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'

const runtimeKeycloakBaseUrl = 'https://runtime-keycloak.example.test/realms/production'

const runtimeProviders = [
  {
    clientId: 'runtime-keycloak-client',
    origin: 'https://runtime-keycloak.example.test',
    path: '/realms/production/protocol/openid-connect/auth',
    provider: 'keycloak',
  },
  {
    clientId: 'runtime-auth0-client',
    origin: 'https://runtime-auth0.example.test',
    path: '/authorize',
    provider: 'auth0',
  },
  {
    clientId: 'runtime-cognito-client',
    origin: 'https://runtime-cognito.example.test',
    path: '/oauth2/authorize',
    provider: 'cognito',
  },
  {
    clientId: 'runtime-logto-client',
    origin: 'https://runtime-logto.example.test',
    path: '/oidc/auth',
    provider: 'logto',
  },
  {
    clientId: 'runtime-zitadel-client',
    origin: 'https://runtime-zitadel.example.test',
    path: '/oauth/v2/authorize',
    provider: 'zitadel',
  },
  {
    clientId: 'runtime-oidc-client',
    origin: 'https://runtime-oidc.example.test',
    path: '/tenant/authorize',
    provider: 'oidc',
  },
] as const

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/runtimeConfigApp', import.meta.url)),
    build: true,
    env: {
      NUXT_OIDC_AUTH_SESSION_SECRET: 'runtime-auth-session-secret-at-least-48-characters-long',
      NUXT_OIDC_PROVIDERS_KEYCLOAK_BASE_URL: runtimeKeycloakBaseUrl,
      NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_ID: 'runtime-keycloak-client',
      NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_SECRET: 'runtime-keycloak-secret',
      NUXT_OIDC_PROVIDERS_KEYCLOAK_REDIRECT_URI: 'https://app.example.test/auth/keycloak/callback',
      NUXT_OIDC_PROVIDERS_AUTH0_BASE_URL: 'https://runtime-auth0.example.test',
      NUXT_OIDC_PROVIDERS_AUTH0_ADDITIONAL_AUTH_PARAMETERS_CONNECTION: 'github',
      NUXT_OIDC_PROVIDERS_AUTH0_CLIENT_ID: 'runtime-auth0-client',
      NUXT_OIDC_PROVIDERS_AUTH0_CLIENT_SECRET: 'runtime-auth0-secret',
      NUXT_OIDC_PROVIDERS_AUTH0_REDIRECT_URI: 'https://app.example.test/auth/auth0/callback',
      NUXT_OIDC_PROVIDERS_COGNITO_BASE_URL: 'https://runtime-cognito.example.test',
      NUXT_OIDC_PROVIDERS_COGNITO_CLIENT_ID: 'runtime-cognito-client',
      NUXT_OIDC_PROVIDERS_COGNITO_CLIENT_SECRET: 'runtime-cognito-secret',
      NUXT_OIDC_PROVIDERS_COGNITO_LOGOUT_REDIRECT_URI: 'https://app.example.test',
      NUXT_OIDC_PROVIDERS_COGNITO_REDIRECT_URI: 'https://app.example.test/auth/cognito/callback',
      NUXT_OIDC_PROVIDERS_GITHUB_CLIENT_ID: 'runtime-github-client',
      NUXT_OIDC_PROVIDERS_GITHUB_CLIENT_SECRET: 'runtime-github-secret',
      NUXT_OIDC_PROVIDERS_LOGTO_BASE_URL: 'https://runtime-logto.example.test',
      NUXT_OIDC_PROVIDERS_LOGTO_CLIENT_ID: 'runtime-logto-client',
      NUXT_OIDC_PROVIDERS_LOGTO_CLIENT_SECRET: 'runtime-logto-secret',
      NUXT_OIDC_PROVIDERS_LOGTO_REDIRECT_URI: 'https://app.example.test/auth/logto/callback',
      NUXT_OIDC_PROVIDERS_OIDC_ADDITIONAL_AUTH_PARAMETERS: '{"prompt":"consent"}',
      NUXT_OIDC_PROVIDERS_OIDC_ALLOWED_CALLBACK_REDIRECT_URLS: '[]',
      NUXT_OIDC_PROVIDERS_OIDC_BASE_URL: 'https://runtime-oidc.example.test/tenant',
      NUXT_OIDC_PROVIDERS_OIDC_CALLBACK_REDIRECT_URL: '',
      NUXT_OIDC_PROVIDERS_OIDC_CLIENT_ID: 'runtime-oidc-client',
      NUXT_OIDC_PROVIDERS_OIDC_CLIENT_SECRET: 'runtime-oidc-secret',
      NUXT_OIDC_PROVIDERS_OIDC_EXPOSE_ACCESS_TOKEN: 'false',
      NUXT_OIDC_PROVIDERS_OIDC_REDIRECT_URI: 'https://app.example.test/auth/oidc/callback',
      NUXT_OIDC_PROVIDERS_OIDC_SCOPE: '["openid","profile"]',
      NUXT_OIDC_PROVIDERS_OIDC_SESSION_CONFIGURATION_AUTOMATIC_REFRESH: 'false',
      NUXT_OIDC_PROVIDERS_OIDC_SESSION_CONFIGURATION_EXPIRATION_THRESHOLD: '0',
      NUXT_OIDC_PROVIDERS_ZITADEL_BASE_URL: 'https://runtime-zitadel.example.test',
      NUXT_OIDC_PROVIDERS_ZITADEL_CLIENT_ID: 'runtime-zitadel-client',
      NUXT_OIDC_PROVIDERS_ZITADEL_REDIRECT_URI: 'https://app.example.test/auth/zitadel/callback',
      NUXT_OIDC_SESSION_SECRET: 'runtime-user-session-secret-at-least-48-characters-long',
      NUXT_OIDC_TOKEN_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
    },
  },
})

async function getAuthorizationRedirect(provider: string): Promise<URL> {
  const response = await fetch(url(`/auth/${provider}/login`), { redirect: 'manual' })

  expect(response.status).toBe(302)
  const location = response.headers.get('location')
  if (!location) throw new Error('Missing authorization redirect location')
  return new URL(location)
}

test.describe('production runtime provider configuration', () => {
  test('applies the complete provider runtime shape after production build', async () => {
    for (const runtimeProvider of runtimeProviders) {
      const location = await getAuthorizationRedirect(runtimeProvider.provider)

      expect(location.origin).toBe(runtimeProvider.origin)
      expect(location.pathname).toBe(runtimeProvider.path)
      expect(location.searchParams.get('client_id')).toBe(runtimeProvider.clientId)
      if (runtimeProvider.provider === 'auth0') {
        expect(location.searchParams.get('connection')).toBe('github')
      }
    }

    const response = await fetch(url('/api/runtime-config'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      additionalAuthParameters: { prompt: 'consent' },
      allowedCallbackRedirectUrls: [],
      callbackRedirectUrl: '',
      exposeAccessToken: false,
      scope: ['openid', 'profile'],
      sessionConfiguration: {
        automaticRefresh: false,
        expirationThreshold: 0,
      },
    })

    const location = await getAuthorizationRedirect('github')

    expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize')
    expect(location.searchParams.get('client_id')).toBe('runtime-github-client')
    expect(location.searchParams.get('redirect_uri')).toBe(
      'https://app.example.test/auth/github/callback',
    )
    expect(location.searchParams.get('scope')).toBe('user:email')
  })
})
