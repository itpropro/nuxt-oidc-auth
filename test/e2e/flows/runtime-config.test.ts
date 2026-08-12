import { fileURLToPath } from 'node:url'
import { url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'

const runtimeKeycloakBaseUrl = 'https://runtime-keycloak.example.test/realms/production'
const runtimeAuth0AuthorizationUrl = 'https://login.example.test/oauth/authorize'

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
      NUXT_OIDC_PROVIDERS_AUTH0_AUTHORIZATION_URL: runtimeAuth0AuthorizationUrl,
      NUXT_OIDC_PROVIDERS_AUTH0_BASE_URL: 'https://runtime-auth0.example.test',
      NUXT_OIDC_PROVIDERS_AUTH0_CLIENT_ID: 'runtime-auth0-client',
      NUXT_OIDC_PROVIDERS_AUTH0_CLIENT_SECRET: 'runtime-auth0-secret',
      NUXT_OIDC_PROVIDERS_AUTH0_REDIRECT_URI: 'https://app.example.test/auth/auth0/callback',
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
  test('derives omitted endpoints from runtime baseUrl', async () => {
    const location = await getAuthorizationRedirect('keycloak')

    expect(location.origin).toBe('https://runtime-keycloak.example.test')
    expect(location.pathname).toBe('/realms/production/protocol/openid-connect/auth')
    expect(location.searchParams.get('client_id')).toBe('runtime-keycloak-client')
    expect(location.searchParams.get('redirect_uri')).toBe(
      'https://app.example.test/auth/keycloak/callback',
    )
  })

  test('uses explicit runtime endpoint overrides', async () => {
    const location = await getAuthorizationRedirect('auth0')

    expect(location.origin + location.pathname).toBe(runtimeAuth0AuthorizationUrl)
    expect(location.searchParams.get('client_id')).toBe('runtime-auth0-client')
    expect(location.searchParams.get('redirect_uri')).toBe(
      'https://app.example.test/auth/auth0/callback',
    )
  })

  test('preserves static provider configuration', async () => {
    const location = await getAuthorizationRedirect('github')

    expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize')
    expect(location.searchParams.get('client_id')).toBe('static-client')
    expect(location.searchParams.get('redirect_uri')).toBe(
      'https://app.example.test/auth/github/callback',
    )
  })
})
