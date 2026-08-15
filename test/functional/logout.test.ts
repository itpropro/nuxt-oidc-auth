import type { OidcProviderConfig } from '../../src/runtime/server/utils/provider'
import { describe, expect, it } from 'vitest'
import { HandlerHarness } from './handler-harness'

const configuredRedirectUri = 'https://app.example.test/configured'
const perCallRedirectUri = 'https://app.example.test/after?next=one&value=two#résumé path'

const providerConfig = {
  clientId: 'functional-client',
  clientSecret: 'functional-secret',
  authorizationUrl: 'https://identity.example.test/authorize',
  tokenUrl: 'https://identity.example.test/token',
  redirectUri: 'https://app.example.test/auth/oidc/callback',
  logoutUrl: 'https://identity.example.test/logout',
  logoutRedirectParameterName: 'post_logout_redirect_uri',
  logoutRedirectUri: configuredRedirectUri,
  requiredProperties: ['clientId', 'clientSecret', 'authorizationUrl', 'tokenUrl', 'redirectUri'],
} satisfies Partial<OidcProviderConfig>

async function invokeLogout(
  query: Record<string, string> = {},
  overrides: Partial<OidcProviderConfig> = {},
) {
  const harness = new HandlerHarness({
    runtimeConfig: {
      oidc: {
        session: {},
        providers: { oidc: { ...providerConfig, ...overrides } },
      },
    },
  })
  const logoutHandler = (await import('../../src/runtime/server/handler/logout.get')).default
  const request = harness.createEvent({ path: '/auth/oidc/logout', query })

  await logoutHandler(request.event)

  expect(request.response.status).toBe(302)
  expect(request.response.location).toBeDefined()
  return new URL(request.response.location!)
}

async function invokePresetLogout(
  provider: 'cognito' | 'zitadel',
  config: Partial<OidcProviderConfig>,
) {
  const harness = new HandlerHarness({
    runtimeConfig: {
      oidc: {
        session: {},
        providers: { [provider]: config },
      },
    },
  })
  const logoutHandler = (await import('../../src/runtime/server/handler/logout.get')).default
  const request = harness.createEvent({ path: `/auth/${provider}/logout` })

  await logoutHandler(request.event)

  expect(request.response).toMatchObject({
    status: 302,
    location: 'https://app.example.test',
  })
}

describe('logout handler redirects', () => {
  it.each(['logoutRedirectUri', 'logout_redirect_uri'])('accepts %s', async (parameter) => {
    const logoutUrl = await invokeLogout({ [parameter]: perCallRedirectUri })

    expect(logoutUrl.searchParams.get('post_logout_redirect_uri')).toBe(perCallRedirectUri)
  })

  it('prefers the canonical spelling when both are present', async () => {
    const logoutUrl = await invokeLogout({
      logoutRedirectUri: perCallRedirectUri,
      logout_redirect_uri: 'https://app.example.test/legacy',
    })

    expect(logoutUrl.searchParams.get('post_logout_redirect_uri')).toBe(perCallRedirectUri)
  })

  it('falls back to the configured redirect', async () => {
    const logoutUrl = await invokeLogout()

    expect(logoutUrl.searchParams.get('post_logout_redirect_uri')).toBe(configuredRedirectUri)
  })

  it('keeps the configured provider parameter name', async () => {
    const logoutUrl = await invokeLogout(
      { logoutRedirectUri: perCallRedirectUri },
      { logoutRedirectParameterName: 'returnTo' },
    )

    expect(logoutUrl.searchParams.get('returnTo')).toBe(perCallRedirectUri)
    expect(logoutUrl.searchParams.has('post_logout_redirect_uri')).toBe(false)
  })

  it('omits the provider redirect parameter when no redirect is available', async () => {
    const logoutUrl = await invokeLogout({}, { logoutRedirectUri: undefined })

    expect(logoutUrl.origin).toBe('https://identity.example.test')
    expect(logoutUrl.pathname).toBe('/logout')
    expect(logoutUrl.search).toBe('')
  })

  it('ignores unrelated strict-validation requirements during logout', async () => {
    const logoutUrl = await invokeLogout(
      {},
      {
        audience: undefined,
        authorizationUrl: '',
        clientId: '',
        clientSecret: '',
        openIdConfiguration: undefined,
        redirectUri: '',
        tokenUrl: '',
        tokenValidationMode: 'strict',
        validateAccessToken: true,
        validateIdToken: true,
      },
    )

    expect(logoutUrl.origin).toBe('https://identity.example.test')
    expect(logoutUrl.pathname).toBe('/logout')
  })

  it('falls back to local logout for an unsafe provider logout URL', async () => {
    const logoutUrl = await invokeLogout({}, { logoutUrl: '/relative/logout' })

    expect(logoutUrl.origin).toBe('https://app.example.test')
    expect(logoutUrl.pathname).toBe('/')
  })

  it('falls back to local logout for a non-HTTP provider URL', async () => {
    const logoutUrl = await invokeLogout(
      {},
      { baseUrl: 'https://issuer.example.test', logoutUrl: 'javascript:alert(1)' },
    )

    expect(logoutUrl.origin).toBe('https://app.example.test')
    expect(logoutUrl.pathname).toBe('/')
  })

  it('falls back to local logout when Cognito provider parameters are incomplete', async () => {
    await invokePresetLogout('cognito', {
      baseUrl: 'https://example.auth.eu-central-1.amazoncognito.com',
      clientId: '',
      clientSecret: 'cognito-secret',
      logoutRedirectUri: '',
    })
  })

  it('falls back to local logout when Zitadel provider parameters are incomplete', async () => {
    await invokePresetLogout('zitadel', {
      baseUrl: 'https://identity.example.test',
      clientId: '',
    })
  })
})
