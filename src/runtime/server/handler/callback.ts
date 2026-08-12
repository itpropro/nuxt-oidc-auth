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
import { normalizeURL, parseURL } from 'ufo'
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
  oidcErrorHandler,
  useOidcLogger,
} from '../utils/oidc'
import { createProviderFetch } from '../utils/provider'
import { resolveCallbackRedirectUrl } from '../utils/redirect'
import { encryptToken, parseJwtToken, validateToken } from '../utils/security'
import { getUserSessionId, setUserSession, useAuthSession } from '../utils/session'

const warnedLegacyValidationProviders = new Set<ProviderKeys>()

function hasExactAudience(payload: JwtPayload | undefined, expectedAudiences: string[]): boolean {
  if (typeof payload?.aud === 'string') return expectedAudiences.includes(payload.aud)
  if (!Array.isArray(payload?.aud)) return false
  return payload.aud.some(
    (audience) => typeof audience === 'string' && expectedAudiences.includes(audience),
  )
}

function isIssuer(value: unknown): value is string | string[] {
  return (
    typeof value === 'string' ||
    (Array.isArray(value) && value.every((issuer) => typeof issuer === 'string'))
  )
}

function isStrictIssuer(value: unknown): value is string | string[] {
  return (
    (typeof value === 'string' && value.trim().length > 0) ||
    (Array.isArray(value) &&
      value.length > 0 &&
      value.every((issuer) => typeof issuer === 'string' && issuer.trim().length > 0))
  )
}

async function validateOidcIdToken(
  token: string,
  options: Parameters<typeof validateToken>[1],
  clientId: string,
  expectedNonce?: string,
  nonceRequired = false,
): Promise<JwtPayload> {
  const payload = await validateToken(token, {
    ...options,
    requiredClaims: [...new Set([...(options.requiredClaims || []), 'sub', 'iat'])],
  })
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('ID token sub must be a non-empty string')
  }
  const authorizedParty = payload.azp
  if (
    (Array.isArray(payload.aud) && payload.aud.length > 1 && typeof authorizedParty !== 'string') ||
    (authorizedParty !== undefined && authorizedParty !== clientId)
  ) {
    throw new Error('ID token azp must match clientId and is required for multiple audiences')
  }
  if (nonceRequired && (typeof expectedNonce !== 'string' || expectedNonce.length === 0)) {
    throw new Error('Authentication session is missing the expected nonce')
  }
  if (nonceRequired && payload.nonce !== expectedNonce) {
    throw new Error('ID token nonce must match the authentication request')
  }
  return payload
}

function callbackEventHandler({ onSuccess }: OAuthConfig<UserSession>) {
  const logger = useOidcLogger()
  return eventHandler(async (event: H3Event) => {
    const provider = event.path.split('/')[2] as ProviderKeys
    const runtimeProviderConfig = useRuntimeConfig().oidc.providers[provider] as OidcProviderConfig
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

    const session = await useAuthSession(event, config.sessionConfiguration?.maxAuthSessionAge)

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
          client_secret: normalizeURL(config.clientSecret),
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
      // Log ofetch error data to console
      const fetchError = error as {
        data?: { error?: string; error_description?: string; suberror?: string }
      }
      logger.error(
        fetchError?.data
          ? `${fetchError.data.error}: ${fetchError.data.error_description}`
          : String(error),
      )

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

    const strictValidation = config.tokenValidationMode === 'strict'
    if (strictValidation && config.validateIdToken && !tokenResponse.id_token) {
      return oidcErrorHandler(event, `[${provider}] Token validation failed: Missing ID token`)
    }

    const legacyAudiences = [config.audience, config.clientId].filter(
      (audience): audience is string => !!audience,
    )
    const legacyAudienceMatched =
      !strictValidation &&
      (hasExactAudience(accessToken, legacyAudiences) || hasExactAudience(idToken, legacyAudiences))
    const validateAccessToken =
      !!config.validateAccessToken && (strictValidation || legacyAudienceMatched)
    const validateIdToken =
      !!config.validateIdToken &&
      !!tokenResponse.id_token &&
      (strictValidation || legacyAudienceMatched)

    if (validateAccessToken || validateIdToken) {
      try {
        const openIdConfiguration =
          config.openIdConfiguration && typeof config.openIdConfiguration === 'object'
            ? config.openIdConfiguration
            : typeof config.openIdConfiguration === 'string'
              ? await customFetch(config.openIdConfiguration)
              : await config.openIdConfiguration!(config)
        const issuer = openIdConfiguration.issuer
        const jwksUri = openIdConfiguration.jwks_uri
        if (
          strictValidation &&
          (!isStrictIssuer(issuer) || typeof jwksUri !== 'string' || !jwksUri)
        ) {
          throw new Error('Strict token validation requires discovery issuer and jwks_uri')
        }
        if (!strictValidation && issuer && !isIssuer(issuer)) {
          throw new Error('OpenID configuration has invalid issuer metadata')
        }
        if (typeof jwksUri !== 'string' || !jwksUri) {
          throw new Error('OpenID configuration is missing jwks_uri')
        }
        const commonValidationOptions = {
          jwksUri,
          ...((strictValidation ? isStrictIssuer(issuer) : isIssuer(issuer)) && { issuer }),
          ...(strictValidation && { requiredClaims: ['exp'] }),
        }
        const legacyAudience = config.audience
          ? { audience: [config.audience, config.clientId] }
          : {}
        tokens = {
          accessToken: validateAccessToken
            ? await validateToken(tokenResponse.access_token, {
                ...commonValidationOptions,
                ...(strictValidation ? { audience: config.audience } : legacyAudience),
              })
            : accessToken,
          ...(tokenResponse.refresh_token && { refreshToken: tokenResponse.refresh_token }),
          ...(tokenResponse.id_token && {
            idToken: validateIdToken
              ? strictValidation
                ? await validateOidcIdToken(
                    tokenResponse.id_token,
                    { ...commonValidationOptions, audience: config.clientId },
                    config.clientId,
                    session.data.nonce,
                    config.nonce,
                  )
                : await validateToken(tokenResponse.id_token, {
                    ...commonValidationOptions,
                    ...legacyAudience,
                  })
              : idToken,
          }),
        }
      } catch (error) {
        return oidcErrorHandler(event, `[${provider}] Token validation failed: ${String(error)}`)
      }
    } else {
      tokens = {
        accessToken,
        ...(tokenResponse.refresh_token && { refreshToken: tokenResponse.refresh_token }),
        ...(idToken && { idToken }),
      }
    }

    if (
      !strictValidation &&
      ((config.validateAccessToken && !validateAccessToken) ||
        (config.validateIdToken && !validateIdToken)) &&
      !warnedLegacyValidationProviders.has(provider)
    ) {
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
      expireAt: tokens.accessToken.exp || timestamp + useRuntimeConfig().oidc.session.maxAge!,
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
      const persistentSession: PersistentSession = {
        createdAt: new Date(),
        updatedAt: new Date(),
        exp: accessToken.exp as number,
        iat: accessToken.iat as number,
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
    await setUserSession(event, user as UserSession)
    return sendRedirect(event, callbackRedirectUrl || ('/' as string))
  },
})
