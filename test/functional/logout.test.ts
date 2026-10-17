import { afterEach, describe, expect, it, vi } from 'vitest'

import type { OidcProviderConfig } from '../../src/runtime/server/utils/provider'
import { encryptToken } from '../../src/runtime/server/utils/security'
import { HandlerHarness } from './handler-harness'

const tokenKey = 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY='

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

async function assertPresetLogout(
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
      // oxlint-disable-next-line eslint/no-script-url -- This hostile URL must be rejected by the production logout handler.
      { baseUrl: 'https://issuer.example.test', logoutUrl: 'javascript:alert(1)' },
    )

    expect(logoutUrl.origin).toBe('https://app.example.test')
    expect(logoutUrl.pathname).toBe('/')
  })

  it('falls back to local logout when Cognito provider parameters are incomplete', async () => {
    await assertPresetLogout('cognito', {
      baseUrl: 'https://example.auth.eu-central-1.amazoncognito.com',
      clientId: '',
      clientSecret: 'cognito-secret',
      logoutRedirectUri: '',
    })
  })

  it('falls back to local logout when Zitadel provider parameters are incomplete', async () => {
    await assertPresetLogout('zitadel', {
      baseUrl: 'https://identity.example.test',
      clientId: '',
    })
  })
})

describe('logout handler hints', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    {
      sessionProvider: 'oidc',
      location:
        'https://identity.example.test/logout?post_logout_redirect_uri=https:%2F%2Fapp.example.test%2Fconfigured&id_token_hint=stored-id-token&logout_hint=user@example.test',
    },
    { sessionProvider: 'keycloak', location: 'https://app.example.test' },
  ])(
    'sends $sessionProvider session hints only to the issuing provider',
    async ({ sessionProvider, location }) => {
      vi.stubEnv('NUXT_OIDC_TOKEN_KEY', tokenKey)
      const harness = new HandlerHarness({
        runtimeConfig: {
          oidc: {
            session: {},
            providers: {
              oidc: {
                ...providerConfig,
                additionalLogoutParameters: { idTokenHint: '', logoutHint: '' },
              },
              keycloak: { ...providerConfig, baseUrl: 'https://keycloak.example.test' },
            },
          },
        },
      })
      const sessionId = `logout-hints-${sessionProvider}`
      const now = Math.trunc(Date.now() / 1000)
      harness.cookieJar.seedSession(
        'nuxt-oidc-auth',
        {
          provider: sessionProvider,
          canRefresh: false,
          claims: { login_hint: 'user@example.test' },
          expireAt: now + 3600,
        },
        sessionId,
      )
      await harness.storage('oidc').setItem(sessionId, {
        createdAt: new Date(),
        updatedAt: new Date(),
        exp: now + 3600,
        iat: now,
        accessToken: await encryptToken('stored-access-token', tokenKey),
        idToken: await encryptToken('stored-id-token', tokenKey),
      })
      const logoutHandler = (await import('../../src/runtime/server/handler/logout.get')).default
      const request = harness.createEvent({ path: '/auth/oidc/logout' })

      await logoutHandler(request.event)

      expect(request.response).toMatchObject({ status: 302, location })
      expect(harness.inspectSession('nuxt-oidc-auth')?.data).toStrictEqual({})
    },
  )
})
