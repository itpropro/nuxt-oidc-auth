import type { H3Event } from 'h3'
import type { OAuthConfig, PersistentSession, ProviderKeys, TokenRequest, TokenRespose, Tokens, UserSession } from '../../types'
import { useRuntimeConfig, useStorage } from '#imports'
import { deleteCookie, eventHandler, getQuery, getRequestURL, readBody, sendRedirect } from 'h3'
import { normalizeURL, parseURL } from 'ufo'
import { textToBase64 } from 'undio'
import * as providerPresets from '../../providers'
import { validateConfig } from '../utils/config'
import { configMerger, convertObjectToSnakeCase, convertTokenRequestToType, oidcErrorHandler, useOidcLogger } from '../utils/oidc'
import { createProviderFetch, type OidcProviderConfig } from '../utils/provider'
import { encryptToken, type JwtPayload, parseJwtToken, validateToken } from '../utils/security'
import { getUserSessionId, setUserSession, useAuthSession } from '../utils/session'

function callbackEventHandler({ onSuccess }: OAuthConfig<UserSession>) {
  const logger = useOidcLogger()
  return eventHandler(async (event: H3Event) => {
    const provider = event.path.split('/')[2] as ProviderKeys
    const config = configMerger(useRuntimeConfig().oidc.providers[provider] as OidcProviderConfig, providerPresets[provider])

    // Create custom fetch instance for this provider
    const customFetch = await createProviderFetch(config)

    const validationResult = validateConfig(config, config.requiredProperties)

    if (!validationResult.valid) {
      logger.error(`[${provider}] Missing configuration properties: `, validationResult.missingProperties?.join(', '))
      oidcErrorHandler(event, 'Invalid configuration')
    }

    const session = await useAuthSession(event, config.sessionConfiguration?.maxAuthSessionAge)

    const { code, state, id_token, admin_consent, error, error_description }: { code: string; state: string; id_token: string; admin_consent: string; error: string; error_description: string } = event.method === 'POST' ? await readBody(event) : getQuery(event)
    let stateObj: { token: string; additionalClientAuthParameters: Record<string, string> } | null = null;
    try {
      stateObj = typeof state === "string" ? JSON.parse(state) : state;
    } catch {
      stateObj = null;
    }

    // Check for admin consent callback
    if (admin_consent) {
      const url = getRequestURL(event)
      sendRedirect(event, `${url.origin}/auth/${provider}/login`, 200)
    }

    // Verify id_token, if available (hybrid flow)
    if (id_token) {
      const parsedIdToken = parseJwtToken(id_token)
      if (parsedIdToken.nonce !== session.data.nonce) {
        oidcErrorHandler(event, 'Nonce mismatch')
      }
    }

    // Check for valid callback
    if (!code || (config.state && !state) || error) {
      if (error) {
        logger.error(`[${provider}] ${error}`, error_description && `: ${error_description}`)
      }
      if (!code) {
        oidcErrorHandler(event, 'Callback failed, missing code')
      }
      oidcErrorHandler(event, 'Callback failed')
    }

    // Check for valid state
    if (config.state && (stateObj?.token! !== session.data.state.token!)) {
      oidcErrorHandler(event, 'State mismatch')
    }

    // Construct request header object
    const headers: HeadersInit = {}

    // Validate if authentication information should be send in header or body
    if (config.authenticationScheme === 'header') {
      const encodedCredentials = textToBase64(`${config.clientId}:${config.clientSecret}`, { dataURL: false })
      headers.authorization = `Basic ${encodedCredentials}`
    }

    // Construct form data for token request
    const requestBody: TokenRequest = {
      client_id: config.clientId,
      code,
      grant_type: config.grantType,
      ...config.redirectUri && { redirect_uri: session.data.redirect || config.redirectUri },
      ...config.scopeInTokenRequest && config.scope && { scope: config.scope.join(' ') },
      ...config.pkce && { code_verifier: session.data.codeVerifier },
      ...(config.authenticationScheme && config.authenticationScheme === 'body') && { client_secret: normalizeURL(config.clientSecret) },
      ...config.additionalTokenParameters && convertObjectToSnakeCase(config.additionalTokenParameters),
    }

    // Make token request
    let tokenResponse: TokenRespose
    try {
      tokenResponse = await customFetch(
        config.tokenUrl,
        {
          method: 'POST',
          headers,
          body: convertTokenRequestToType(requestBody, config.tokenRequestType ?? undefined),
        },
      )
    }
    catch (error: any) {
      // Log ofetch error data to console
      logger.error(error?.data ? `${error.data.error}: ${error.data.error_description}` : error)

      // Handle Microsoft consent_required error
      if (error?.data?.suberror === 'consent_required') {
        const consentUrl = `https://login.microsoftonline.com/${parseURL(config.authorizationUrl).pathname.split('/')[1]}/adminconsent?client_id=${config.clientId}`
        return sendRedirect(
          event,
          consentUrl,
          302,
        )
      }
      return oidcErrorHandler(event, 'Token request failed')
    }

    // Initialize tokens object
    let tokens: Tokens

    // Validate tokens only if audience is matched
    let accessToken: JwtPayload | Record<string, never>
    let idToken: JwtPayload | Record<string, never> | undefined
    if (!tokenResponse.access_token)
      return oidcErrorHandler(event, `[${provider}] No access token found`)
    try {
      accessToken = parseJwtToken(tokenResponse.access_token, !!config.skipAccessTokenParsing)
      idToken = tokenResponse.id_token ? parseJwtToken(tokenResponse.id_token) : undefined
    }
    catch (error) {
      return oidcErrorHandler(event, `[${provider}] Token parsing failed: ${error}`)
    }
    if ([config.audience as string, config.clientId].some(audience => accessToken.aud?.includes(audience) || idToken?.aud?.includes(audience)) && (config.validateAccessToken || config.validateIdToken)) {
      // Get OIDC configuration
      const openIdConfiguration = (config.openIdConfiguration && typeof config.openIdConfiguration === 'object')
        ? config.openIdConfiguration
        : typeof config.openIdConfiguration === 'string'
          ? await customFetch(config.openIdConfiguration)
          : await (config.openIdConfiguration!)(config)
      const validationOptions = { jwksUri: openIdConfiguration.jwks_uri as string, ...openIdConfiguration.issuer && { issuer: openIdConfiguration.issuer as string }, ...config.audience && { audience: [config.audience, config.clientId] } }
      try {
        tokens = {
          accessToken: config.validateAccessToken ? await validateToken(tokenResponse.access_token, validationOptions) : accessToken,
          ...tokenResponse.refresh_token && { refreshToken: tokenResponse.refresh_token },
          ...tokenResponse.id_token && { idToken: config.validateIdToken ? await validateToken(tokenResponse.id_token, validationOptions) : parseJwtToken(tokenResponse.id_token) },
        }
      }
      catch (error) {
        return oidcErrorHandler(event, `[${provider}] Token validation failed: ${error}`)
      }
    }
    else {
      logger.info('Skipped token validation')
      tokens = {
        accessToken,
        ...tokenResponse.refresh_token && { refreshToken: tokenResponse.refresh_token },
        ...tokenResponse.id_token && { idToken: parseJwtToken(tokenResponse.id_token) },
      }
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
          ? Object.fromEntries(Object.entries(userInfoResult).filter(([key]) => config.filterUserInfo?.includes(key)))
          : userInfoResult
      }
    }
    catch (error) {
      logger.warn(`[${provider}] Failed to fetch userinfo`, error)
    }

    // Get user name from access token
    if (config.userNameClaim) {
      user.userName = (config.userNameClaim in tokens.accessToken) ? tokens.accessToken[config.userNameClaim] as string : ''
    }

    // Get optional claims from id token
    if (config.optionalClaims && tokens.idToken) {
      const parsedIdToken = tokens.idToken
      user.claims = {}
      config.optionalClaims.forEach(claim => parsedIdToken[claim] && ((user.claims as Record<string, unknown>)[claim] = (parsedIdToken[claim])))
    }

    if (tokenResponse.refresh_token || config.exposeAccessToken || config.exposeIdToken) {
      const tokenKey = process.env.NUXT_OIDC_TOKEN_KEY as string
      const persistentSession: PersistentSession = {
        createdAt: new Date(),
        updatedAt: new Date(),
        exp: accessToken.exp as number,
        iat: accessToken.iat as number,
        accessToken: await encryptToken(tokenResponse.access_token, tokenKey),
        ...tokenResponse.refresh_token && { refreshToken: await encryptToken(tokenResponse.refresh_token, tokenKey) },
        ...tokenResponse.id_token && { idToken: await encryptToken(tokenResponse.id_token, tokenKey) },
      }
      if (config.sessionConfiguration?.singleSignOut && config.sessionConfiguration?.singleSignOutIdField && (tokens.accessToken[config.sessionConfiguration.singleSignOutIdField] || tokens.idToken?.[config.sessionConfiguration.singleSignOutIdField])) {
        persistentSession.singleSignOutId = tokens.accessToken.sub || tokens.idToken?.sub
      }
      const userSessionId = await getUserSessionId(event)
      await useStorage('oidc').setItem<PersistentSession>(userSessionId, persistentSession)
    }

    await session.clear()
    deleteCookie(event, 'oidc')
    return onSuccess(event, {
      user,
      callbackRedirectUrl: (stateObj?.additionalClientAuthParameters?.redirectUriOverride ??
        (config.callbackRedirectUrl as string)),
    })
  })
}

export default callbackEventHandler({
  async onSuccess(event, { user, callbackRedirectUrl }) {
    await setUserSession(event, user as UserSession)
    return sendRedirect(event, callbackRedirectUrl || '/' as string)
  },
})
