import type {
  OAuthConfig,
  PersistentSession,
  ProviderKeys,
  TokenRequest,
  TokenRespose,
  Tokens,
  UserSession,
} from '../../types'
import type { H3Event } from 'h3'
import type { OidcProviderConfig } from '../utils/provider'
import type { JwtPayload } from '../utils/security'
import { useRuntimeConfig } from '#imports'
import { deleteCookie, eventHandler, getQuery, getRequestURL, readBody, sendRedirect } from 'h3'
import { useStorage } from 'nitropack/runtime'
import { parseURL } from 'ufo'
import * as providerPresets from '../../providers'
import {
  hasExplicitProviderConfig,
  resolveProviderConfig,
  validateProviderConfig,
} from '../utils/config'
import { textToBase64 } from '../utils/encoding'
import {
  convertObjectToSnakeCase,
  convertTokenRequestToType,
  formatTokenRequestError,
  oidcErrorHandler,
  useOidcLogger,
} from '../utils/oidc'
import { createProviderFetch } from '../utils/provider'
import { resolveCallbackRedirectUrl } from '../utils/redirect'
import { encryptToken, parseJwtToken } from '../utils/security'
import {
  getUserSessionId,
  hasValidUserSession,
  replaceTokenDerivedUserSession,
  useAuthSession,
} from '../utils/session'
import { validateTokenResponse } from '../utils/token-validation'

const warnedLegacyValidationProviders = new Set<ProviderKeys>()

function callbackEventHandler({ onSuccess }: OAuthConfig<UserSession>) {
  const logger = useOidcLogger()
  return eventHandler(async (event: H3Event) => {
    const provider = event.path.split('/')[2] as ProviderKeys
    const runtimeConfig = useRuntimeConfig()
    const runtimeProviderConfig = runtimeConfig.oidc.providers[provider] as OidcProviderConfig
    const config = resolveProviderConfig(runtimeProviderConfig, providerPresets[provider])
    const hasConfiguredCallbackRedirectUrl = hasExplicitProviderConfig(
      runtimeProviderConfig,
      'callbackRedirectUrl',
    )

    const validationResult = validateProviderConfig(config)

    if (!validationResult.valid) {
      logger.error(
        config.tokenValidationMode === 'strict'
          ? `[${provider}] Strict token validation requires non-empty configuration properties:`
          : `[${provider}] Missing or empty configuration properties:`,
        validationResult.missingProperties?.join(', '),
      )
      return oidcErrorHandler(event, 'Invalid configuration')
    }

    // Create custom fetch instance for this provider
    const customFetch = await createProviderFetch(config)

    const session = await useAuthSession(
      event,
      config.sessionConfiguration?.maxAuthSessionAge ??
        runtimeConfig.oidc.session?.maxAuthSessionAge,
    )

    const {
      code,
      state,
      id_token,
      admin_consent,
      error,
      error_description,
    }: {
      code: string
      state: string
      id_token: string
      admin_consent: string
      error: string
      error_description: string
    } = event.method === 'POST' ? await readBody(event) : getQuery(event)

    // Check for admin consent callback
    if (admin_consent) {
      const url = getRequestURL(event)
      return sendRedirect(event, `${url.origin}/auth/${provider}/login`, 200)
    }

    // Verify id_token, if available (hybrid flow)
    if (id_token) {
      const parsedIdToken = parseJwtToken(id_token)
      if (parsedIdToken.nonce !== session.data.nonce) {
        return oidcErrorHandler(event, 'Nonce mismatch')
      }
    }

    const isStaleCallback =
      !code &&
      (!error ||
        (error === 'temporarily_unavailable' && error_description === 'authentication_expired'))
    if (isStaleCallback && (await hasValidUserSession(event))) {
      logger.info(`[${provider}] Preserving the current session after a stale callback`)
      return sendRedirect(event, '/', 302)
    }

    // Check for valid callback
    if (!code || (config.state && !state) || error) {
      if (error) {
        logger.error(`[${provider}] ${error}`, error_description && `: ${error_description}`)
      }
      if (!code) {
        return oidcErrorHandler(event, 'Callback failed, missing code')
      }
      return oidcErrorHandler(event, 'Callback failed')
    }

    // Check for valid state
    if (config.state && state !== session.data.state) {
      return oidcErrorHandler(event, 'State mismatch')
    }

    // Construct request header object
    const headers: HeadersInit = {}

    // Validate if authentication information should be send in header or body
    if (config.authenticationScheme === 'header') {
      const encodedCredentials = textToBase64(`${config.clientId}:${config.clientSecret}`, {
        dataURL: false,
      })
      headers.authorization = `Basic ${encodedCredentials}`
    }

    // Construct form data for token request
    const requestBody: TokenRequest = {
      client_id: config.clientId,
      code,
      grant_type: config.grantType,
      ...(config.redirectUri && { redirect_uri: session.data.redirect || config.redirectUri }),
      ...(config.scopeInTokenRequest && config.scope && { scope: config.scope.join(' ') }),
      ...(config.pkce && { code_verifier: session.data.codeVerifier }),
      ...(config.authenticationScheme &&
        config.authenticationScheme === 'body' && {
          client_secret: config.clientSecret,
        }),
      ...(config.additionalTokenParameters &&
        convertObjectToSnakeCase(config.additionalTokenParameters)),
    }

    // Make token request
    let tokenResponse: TokenRespose
    try {
      tokenResponse = await customFetch(config.tokenUrl, {
        method: 'POST',
        headers,
        body: convertTokenRequestToType(requestBody, config.tokenRequestType ?? undefined),
      })
    } catch (error: unknown) {
      const fetchError = error as {
        data?: { error?: string; error_description?: string; suberror?: string }
      }
      logger.error(formatTokenRequestError(error, config.clientSecret))

      // Handle Microsoft consent_required error
      if (fetchError?.data?.suberror === 'consent_required') {
        const consentUrl = `https://login.microsoftonline.com/${parseURL(config.authorizationUrl).pathname.split('/')[1]}/adminconsent?client_id=${config.clientId}`
        return sendRedirect(event, consentUrl, 302)
      }
      return oidcErrorHandler(event, 'Token request failed')
    }

    // Initialize tokens object
    let tokens: Tokens

    let accessToken: JwtPayload | Record<string, never>
    let idToken: JwtPayload | Record<string, never> | undefined
    if (!tokenResponse.access_token)
      return oidcErrorHandler(event, `[${provider}] No access token found`)
    try {
      accessToken = parseJwtToken(tokenResponse.access_token, !!config.skipAccessTokenParsing)
      idToken = tokenResponse.id_token ? parseJwtToken(tokenResponse.id_token) : undefined
    } catch (error) {
      return oidcErrorHandler(event, `[${provider}] Token parsing failed: ${String(error)}`)
    }

    let legacyValidationSkipped: boolean
    try {
      const validationResult = await validateTokenResponse({
        accessToken,
        config,
        customFetch,
        expectedNonce: session.data.nonce,
        idToken,
        nonceRequired:
          config.tokenValidationMode === 'strict' &&
          (config.nonce || config.responseType.includes('token')),
        tokenResponse,
      })
      tokens = validationResult.tokens
      legacyValidationSkipped = validationResult.legacyValidationSkipped
    } catch (error) {
      return oidcErrorHandler(event, `[${provider}] Token validation failed: ${String(error)}`)
    }

    if (legacyValidationSkipped && !warnedLegacyValidationProviders.has(provider)) {
      warnedLegacyValidationProviders.add(provider)
      logger.warn(
        `[${provider}] Legacy token validation skipped an enabled token because no token audience matched or the token was unavailable. Configure tokenValidationMode: 'strict' to validate enabled JWT tokens without trusting decoded claims.`,
      )
    }

    // Construct user object
    const timestamp = Math.trunc(Date.now() / 1000) // Use seconds instead of milliseconds to align with JWT
    const user: UserSession = {
      canRefresh: !!tokens.refreshToken,
      singleSignOut: !!config.sessionConfiguration?.singleSignOut,
      loggedInAt: timestamp,
      updatedAt: timestamp,
      expireAt: tokens.accessToken.exp ?? timestamp + runtimeConfig.oidc.session.maxAge!,
      provider,
    }

    // Request userinfo
    try {
      if (config.userInfoUrl) {
        const userInfoResult = await customFetch(config.userInfoUrl, {
          headers: {
            Authorization: `${tokenResponse.token_type} ${tokenResponse.access_token}`,
          },
        })
        user.userInfo = config.filterUserInfo
          ? Object.fromEntries(
              Object.entries(userInfoResult).filter(([key]) =>
                config.filterUserInfo?.includes(key),
              ),
            )
          : userInfoResult
      }
    } catch (error) {
      logger.warn(`[${provider}] Failed to fetch userinfo`, error)
    }

    // Get user name from access token
    if (config.userNameClaim) {
      user.userName =
        config.userNameClaim in tokens.accessToken
          ? (tokens.accessToken[config.userNameClaim] as string)
          : ''
    }

    // Get optional claims from id token
    if (config.optionalClaims && tokens.idToken) {
      const parsedIdToken = tokens.idToken
      user.claims = {}
      config.optionalClaims.forEach((claim) => {
        if (parsedIdToken[claim]) {
          ;(user.claims as Record<string, unknown>)[claim] = parsedIdToken[claim]
        }
      })
    }

    if (tokenResponse.refresh_token || config.exposeAccessToken || config.exposeIdToken) {
      const tokenKey = process.env.NUXT_OIDC_TOKEN_KEY as string
      const expiresIn = Number(tokenResponse.expires_in)
      const persistentSession: PersistentSession = {
        createdAt: new Date(),
        updatedAt: new Date(),
        exp:
          accessToken.exp ?? (Number.isFinite(expiresIn) ? timestamp + expiresIn : user.expireAt),
        iat: accessToken.iat ?? timestamp,
        accessToken: await encryptToken(tokenResponse.access_token, tokenKey),
        ...(tokenResponse.refresh_token && {
          refreshToken: await encryptToken(tokenResponse.refresh_token, tokenKey),
        }),
        ...(tokenResponse.id_token && {
          idToken: await encryptToken(tokenResponse.id_token, tokenKey),
        }),
      }
      if (
        config.sessionConfiguration?.singleSignOut &&
        config.sessionConfiguration?.singleSignOutIdField &&
        (tokens.accessToken[config.sessionConfiguration.singleSignOutIdField] ||
          tokens.idToken?.[config.sessionConfiguration.singleSignOutIdField])
      ) {
        persistentSession.singleSignOutId = tokens.accessToken.sub || tokens.idToken?.sub
      }
      const userSessionId = await getUserSessionId(event)
      await useStorage('oidc').setItem<PersistentSession>(userSessionId, persistentSession)
    }

    const sessionCallbackRedirectUrl = session.data.callbackRedirectUrl
    await session.clear()
    deleteCookie(event, 'oidc')
    return onSuccess(event, {
      user,
      callbackRedirectUrl: resolveCallbackRedirectUrl({
        configuredCallbackRedirectUrl: config.callbackRedirectUrl,
        hasConfiguredCallbackRedirectUrl,
        sessionCallbackRedirectUrl,
      }),
    })
  })
}

export default callbackEventHandler({
  async onSuccess(event, { user, callbackRedirectUrl }) {
    await replaceTokenDerivedUserSession(event, user as UserSession)
    return sendRedirect(event, callbackRedirectUrl || ('/' as string))
  },
})
