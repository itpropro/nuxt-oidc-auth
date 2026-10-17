import type { H3Event } from 'h3'
import { deleteCookie, eventHandler, getQuery, getRequestURL, readBody, sendRedirect } from 'h3'
import { parseURL } from 'ufo'

import { useRuntimeConfig } from '#imports'

import * as providerPresets from '../../providers'
import type {
  OAuthConfig,
  PersistentSession,
  ProviderKeys,
  TokenRequest,
  TokenRespose,
  Tokens,
  UserSession,
} from '../../types'
import {
  formatProviderConfigValidation,
  hasExplicitProviderConfig,
  resolveEffectiveProviderConfig,
  validateProviderConfig,
} from '../utils/config'
import { textToBase64 } from '../utils/encoding'
import { useOidcLogger } from '../utils/logger'
import {
  convertObjectToSnakeCase,
  convertTokenRequestToType,
  formatTokenRequestError,
  oidcErrorHandler,
} from '../utils/oidc'
import type { OidcProviderConfig } from '../utils/provider'
import { createProviderFetch } from '../utils/provider'
import { isOidcProvider } from '../utils/provider-config'
import { resolveCallbackRedirectUrl, withAppBase } from '../utils/redirect'
import type { JwtPayload } from '../utils/security'
import { encryptToken, parseJwtToken } from '../utils/security'
import {
  hasValidUserSession,
  rotateUserSession,
  stampSingleSignOutGeneration,
  useAuthSession,
} from '../utils/session'
import { validateTokenResponse } from '../utils/token-validation'

const providerPresetsByName = { ...providerPresets }

const warnedLegacyValidationProviders = new Set<ProviderKeys>()

function callbackEventHandler({ onSuccess }: OAuthConfig<UserSession>) {
  const logger = useOidcLogger()
  return eventHandler(async (event: H3Event) => {
    const provider = event.path.split('/')[2]
    const runtimeConfig = useRuntimeConfig()
    if (!isOidcProvider(provider)) {
      await oidcErrorHandler(
        event,
        `[${provider}] Provider discovery failed: Unknown OIDC provider`,
      )
      return
    }
    const runtimeProviderConfig = runtimeConfig.oidc.providers[provider]
    let config: OidcProviderConfig
    try {
      config = await resolveEffectiveProviderConfig(
        runtimeProviderConfig,
        providerPresetsByName[provider],
      )
    } catch (error) {
      await oidcErrorHandler(event, `[${provider}] Provider discovery failed: ${String(error)}`)
      return
    }
    const hasConfiguredCallbackRedirectUrl = hasExplicitProviderConfig(
      runtimeProviderConfig,
      'callbackRedirectUrl',
    )

    const validationResult = validateProviderConfig(config, 'callback')

    if (!validationResult.valid) {
      logger.error(
        `[${provider}] Invalid configuration: ${formatProviderConfigValidation(validationResult)}`,
      )
      await oidcErrorHandler(event, 'Invalid configuration')
      return
    }

    // Create custom fetch instance for this provider
    const customFetch = await createProviderFetch(config)

    const session = await useAuthSession(
      event,
      config.sessionConfiguration?.maxAuthSessionAge ??
        // oxlint-disable-next-line typescript/no-unnecessary-condition -- Runtime overrides and request adapters can omit the session object; preserve the existing auth-session fallback.
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
      await sendRedirect(event, `${url.origin}${withAppBase(`/auth/${provider}/login`)}`, 200)
      return
    }

    // Verify id_token, if available (hybrid flow)
    if (id_token) {
      const parsedIdToken = parseJwtToken(id_token)
      if (parsedIdToken['nonce'] !== session.data.nonce) {
        await oidcErrorHandler(event, 'Nonce mismatch')
        return
      }
    }

    const isStaleCallback =
      !code &&
      (!error ||
        (error === 'temporarily_unavailable' && error_description === 'authentication_expired'))
    if (isStaleCallback && (await hasValidUserSession(event))) {
      logger.info(`[${provider}] Preserving the current session after a stale callback`)
      await sendRedirect(event, withAppBase('/'), 302)
      return
    }

    // Check for valid callback
    if (!code || (Boolean(config.state) && !state) || error) {
      if (error) {
        logger.error(`[${provider}] ${error}`, error_description && `: ${error_description}`)
      }
      if (!code) {
        await oidcErrorHandler(event, 'Callback failed, missing code')
        return
      }
      await oidcErrorHandler(event, 'Callback failed')
      return
    }

    // Check for valid state
    if (Boolean(config.state) && state !== session.data.state) {
      await oidcErrorHandler(event, 'State mismatch')
      return
    }

    // PKCE binds the code to this browser's auth transaction. Without a verifier, a provider that
    // does not mandate PKCE would redeem a code issued to someone else without a challenge.
    if (Boolean(config.pkce) && !session.data.codeVerifier) {
      await oidcErrorHandler(event, 'Callback failed, missing auth transaction')
      return
    }

    // Construct request header object
    const headers: HeadersInit = {}

    // Validate if authentication information should be send in header or body
    if (config.authenticationScheme === 'header') {
      const encodedCredentials = textToBase64(`${config.clientId}:${config.clientSecret}`)
      headers['authorization'] = `Basic ${encodedCredentials}`
    }

    // Construct form data for token request
    const hasSessionRedirect = Boolean(session.data.redirect)
    const requestBody: TokenRequest = {
      client_id: config.clientId,
      code,
      grant_type: config.grantType,
      ...(config.redirectUri !== '' && {
        redirect_uri: hasSessionRedirect ? session.data.redirect : config.redirectUri,
      }),
      ...(Boolean(config.scopeInTokenRequest) && config.scope && { scope: config.scope.join(' ') }),
      ...(Boolean(config.pkce) && { code_verifier: session.data.codeVerifier }),
      ...(config.authenticationScheme === 'body' && {
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
    } catch (tokenRequestError: unknown) {
      logger.error(formatTokenRequestError(tokenRequestError, config.clientSecret))

      // Handle Microsoft consent_required error
      if (
        tokenRequestError !== null &&
        typeof tokenRequestError === 'object' &&
        'data' in tokenRequestError &&
        tokenRequestError.data !== null &&
        typeof tokenRequestError.data === 'object' &&
        'suberror' in tokenRequestError.data &&
        tokenRequestError.data.suberror === 'consent_required'
      ) {
        const pathname = parseURL(config.authorizationUrl).pathname
        const tenantStart = pathname.indexOf('/')
        const tenantEnd = pathname.indexOf('/', tenantStart + 1)
        const tenant =
          tenantStart === -1
            ? undefined
            : pathname.slice(tenantStart + 1, tenantEnd === -1 ? undefined : tenantEnd)
        const consentUrl = `https://login.microsoftonline.com/${tenant}/adminconsent?client_id=${config.clientId}`
        await sendRedirect(event, consentUrl, 302)
        return
      }
      await oidcErrorHandler(event, 'Token request failed')
      return
    }

    // Initialize tokens object
    let tokens: Tokens

    let accessToken: JwtPayload | Record<string, never>
    let idToken: JwtPayload | Record<string, never> | undefined
    if (!tokenResponse.access_token) {
      await oidcErrorHandler(event, `[${provider}] No access token found`)
      return
    }
    try {
      accessToken = parseJwtToken(
        tokenResponse.access_token,
        Boolean(config.skipAccessTokenParsing),
      )
      idToken =
        tokenResponse.id_token !== undefined && tokenResponse.id_token !== ''
          ? parseJwtToken(tokenResponse.id_token)
          : undefined
    } catch (parsingError) {
      await oidcErrorHandler(event, `[${provider}] Token parsing failed: ${String(parsingError)}`)
      return
    }

    let legacyValidationSkipped: boolean
    try {
      const tokenValidationResult = await validateTokenResponse({
        accessToken,
        config,
        customFetch,
        expectedNonce: session.data.nonce,
        idToken,
        nonceRequired:
          config.tokenValidationMode === 'strict' &&
          (Boolean(config.nonce) || config.responseType.includes('token')),
        tokenResponse,
      })
      tokens = tokenValidationResult.tokens
      legacyValidationSkipped = tokenValidationResult.legacyValidationSkipped
    } catch (validationError) {
      await oidcErrorHandler(
        event,
        `[${provider}] Token validation failed: ${String(validationError)}`,
      )
      return
    }

    if (legacyValidationSkipped && !warnedLegacyValidationProviders.has(provider)) {
      warnedLegacyValidationProviders.add(provider)
      logger.warn(
        `[${provider}] Legacy token validation skipped an enabled token because no token audience matched or the token was unavailable. Configure tokenValidationMode: 'strict' to validate enabled JWT tokens without trusting decoded claims.`,
      )
    }

    // Construct user object
    const timestamp = Math.trunc(Date.now() / 1000)
    const user: UserSession = {
      canRefresh: Boolean(tokens.refreshToken),
      singleSignOut: Boolean(config.sessionConfiguration?.singleSignOut),
      loggedInAt: timestamp,
      updatedAt: timestamp,
      expireAt: tokens.accessToken.exp ?? timestamp + Number(runtimeConfig.oidc.session.maxAge),
      provider,
    }

    // Request userinfo
    try {
      if (config.userInfoUrl !== undefined && config.userInfoUrl !== '') {
        const userInfoResult = await customFetch<NonNullable<UserSession['userInfo']>>(
          config.userInfoUrl,
          {
            headers: {
              Authorization: `${tokenResponse.token_type} ${tokenResponse.access_token}`,
            },
          },
        )
        user.userInfo = config.filterUserInfo
          ? Object.fromEntries(
              Object.entries(userInfoResult).filter(
                ([key]) => config.filterUserInfo?.includes(key) === true,
              ),
            )
          : userInfoResult
      }
    } catch (userInfoError) {
      logger.warn(`[${provider}] Failed to fetch userinfo`, userInfoError)
    }

    // Get user name from access token
    if (config.userNameClaim !== undefined && config.userNameClaim !== '') {
      if (config.userNameClaim in tokens.accessToken) {
        // SAFETY: Preserve the configured claim value without coercion, as the existing session contract requires.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The configured userNameClaim retains its existing provider value.
        user.userName = tokens.accessToken[config.userNameClaim] as string
      } else {
        user.userName = ''
      }
    }

    // Get optional claims from id token
    if (config.optionalClaims && tokens.idToken) {
      const parsedIdToken = tokens.idToken
      user.claims = {}
      for (const claim of config.optionalClaims) {
        const value = parsedIdToken[claim]
        const hasValue = Boolean(value)
        if (hasValue) {
          user.claims[claim] = value
        }
      }
    }

    const legacyTokenPersistence =
      Boolean(tokenResponse.refresh_token) ||
      Boolean(config.exposeAccessToken) ||
      Boolean(config.exposeIdToken)
    user.tokensStored = legacyTokenPersistence || Boolean(config.storeAccessToken)
    let persistentSession: PersistentSession | undefined
    if (user.tokensStored) {
      const tokenKey = process.env['NUXT_OIDC_TOKEN_KEY']
      if (tokenKey === undefined) {
        throw new Error('NUXT_OIDC_TOKEN_KEY is not configured')
      }
      const expiresIn = Number(tokenResponse.expires_in)
      persistentSession = {
        createdAt: new Date(),
        updatedAt: new Date(),
        exp:
          accessToken.exp ?? (Number.isFinite(expiresIn) ? timestamp + expiresIn : user.expireAt),
        iat: accessToken.iat ?? timestamp,
        accessToken: await encryptToken(tokenResponse.access_token, tokenKey),
        ...(tokenResponse.refresh_token !== undefined &&
          tokenResponse.refresh_token !== '' && {
            refreshToken: await encryptToken(tokenResponse.refresh_token, tokenKey),
          }),
        ...(tokenResponse.id_token !== undefined &&
          tokenResponse.id_token !== '' && {
            idToken: await encryptToken(tokenResponse.id_token, tokenKey),
          }),
      }
      // storeAccessToken alone keeps the browser session as the only single sign-out identity
      if (
        legacyTokenPersistence &&
        config.sessionConfiguration?.singleSignOut === true &&
        config.sessionConfiguration.singleSignOutIdField !== undefined &&
        (Boolean(tokens.accessToken[config.sessionConfiguration.singleSignOutIdField]) ||
          Boolean(tokens.idToken?.[config.sessionConfiguration.singleSignOutIdField]))
      ) {
        persistentSession.singleSignOutId =
          tokens.accessToken.sub !== undefined && tokens.accessToken.sub !== ''
            ? tokens.accessToken.sub
            : tokens.idToken?.sub
      }
      if (
        config.sessionConfiguration?.singleSignOut === true &&
        persistentSession.refreshToken !== undefined &&
        (persistentSession.singleSignOutId ?? '') === ''
      ) {
        logger.warn(
          `[${provider}] No single sign-out identity found, single sign-out only covers this session`,
        )
      }
      persistentSession = await stampSingleSignOutGeneration(provider, persistentSession)
    }

    const sessionCallbackRedirectUrl = session.data.callbackRedirectUrl
    await session.clear()
    deleteCookie(event, 'oidc')
    if (!(await rotateUserSession(event, user, persistentSession))) {
      logger.error(`[${provider}] User session cookie exceeds the browser cookie size limit`)
      await sendRedirect(event, withAppBase('/'), 302)
      return
    }
    await onSuccess(event, {
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
  async onSuccess(event, { callbackRedirectUrl }) {
    await sendRedirect(
      event,
      withAppBase(
        callbackRedirectUrl !== undefined && callbackRedirectUrl !== '' ? callbackRedirectUrl : '/',
      ),
    )
  },
})
