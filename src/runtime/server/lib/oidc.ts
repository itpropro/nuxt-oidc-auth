import type { H3Event } from 'h3'
import type { AuthorizationRequest, AuthSession, OAuthConfig, PersistentSession, PkceAuthorizationRequest, ProviderKeys, TokenRequest, TokenRespose, Tokens, UserSession } from '../../types'
import type { OidcProviderConfig } from '../utils/provider'
import { deleteCookie, eventHandler, getQuery, getRequestHeader, getRequestURL, readBody, sendRedirect, useSession } from 'h3'
import { SignJWT } from 'jose'
import { ofetch } from 'ofetch'
import { normalizeURL, parseURL, withQuery } from 'ufo'
import { subtle } from 'uncrypto'
import * as providerPresets from '../../providers'
import { validateConfig } from '../utils/config'
import { configMerger, convertObjectToSnakeCase, convertTokenRequestToType, oidcErrorHandler, useOidcLogger } from '../utils/oidc'
import { encryptToken, generatePkceCodeChallenge, generatePkceVerifier, generateRandomUrlSafeString, parseJwtToken, validateToken } from '../utils/security'
import { clearUserSession, getUserSession, getUserSessionId } from '../utils/session'
// @ts-expect-error - Missing Nitro type exports in Nuxt
import { useRuntimeConfig, useStorage } from '#imports'
import { textToBase64 } from 'undio'

async function useAuthSession(event: H3Event) {
  const session = await useSession<AuthSession>(event, {
    name: 'oidc',
    password: process.env.NUXT_OIDC_AUTH_SESSION_SECRET as string,
    maxAge: 300, // 5 minutes if for example registration takes place
  })
  return session
}

export function loginEventHandler() {
  const logger = useOidcLogger()
  return eventHandler(async (event: H3Event) => {
    // TODO: Is this the best way to get the current provider?
    const provider = event.path.split('/')[2] as ProviderKeys
    const config = configMerger(useRuntimeConfig().oidc.providers[provider] as OidcProviderConfig, providerPresets[provider])
    const validationResult = validateConfig(config, config.requiredProperties)

    if (!validationResult.valid) {
      logger.error(`[${provider}] Missing configuration properties:`, validationResult.missingProperties?.join(', '))
      oidcErrorHandler(event, 'Invalid configuration')
    }

    // Initialize auth session
    const session = await useAuthSession(event)
    await session.update({
      state: generateRandomUrlSafeString(),
      codeVerifier: generatePkceVerifier(),
      redirect: getRequestHeader(event, 'referer'),
    })

    // Get client side query parameters
    const additionalClientAuthParameters: Record<string, string> = {}
    if (config.allowedClientAuthParameters?.length) {
      const clientQueryParams = getQuery(event)
      config.allowedClientAuthParameters.forEach((param) => {
        if (clientQueryParams[param]) {
          additionalClientAuthParameters[param] = clientQueryParams[param] as string
        }
      })
    }

    const query: AuthorizationRequest | PkceAuthorizationRequest = {
      client_id: config.clientId,
      response_type: config.responseType,
      ...config.state && { state: session.data.state },
      ...config.scope && { scope: config.scope.join(' ') },
      ...config.responseMode && { response_mode: config.responseMode },
      ...config.redirectUri && { redirect_uri: config.redirectUri },
      ...config.prompt && { prompt: config.prompt.join(' ') },
      ...config.pkce && { code_challenge: await generatePkceCodeChallenge(session.data.codeVerifier), code_challenge_method: 'S256' },
      ...config.additionalAuthParameters && convertObjectToSnakeCase(config.additionalAuthParameters),
      ...additionalClientAuthParameters && convertObjectToSnakeCase(additionalClientAuthParameters),
    }

    // Handling hybrid flows or mitigate replay attacks with nonce
    if (config.responseType.includes('token') || config.nonce) {
      const nonce = generateRandomUrlSafeString()
      await session.update({ nonce })
      query.response_mode = 'form_post'
      query.nonce = nonce
      if (!query.scope?.includes('openid'))
        query.scope = `openid ${query.scope}`
    }

    return sendRedirect(
      event,
      config.encodeRedirectUri ? withQuery(config.authorizationUrl, query).replace(query.redirect_uri!, encodeURI(query.redirect_uri!)) : withQuery(config.authorizationUrl, query),
      200,
    )
  })
}

export function callbackEventHandler({ onSuccess }: OAuthConfig<UserSession>) {
  const logger = useOidcLogger()
  return eventHandler(async (event: H3Event) => {
    const provider = event.path.split('/')[2] as ProviderKeys
    const config = configMerger(useRuntimeConfig().oidc.providers[provider] as OidcProviderConfig, providerPresets[provider])

    const validationResult = validateConfig(config, config.requiredProperties)

    if (!validationResult.valid) {
      logger.error(`[${provider}] Missing configuration properties: `, validationResult.missingProperties?.join(', '))
      oidcErrorHandler(event, 'Invalid configuration')
    }

    const session = await useAuthSession(event)

    const { code, state, id_token, admin_consent, error, error_description }: { code: string; state: string; id_token: string; admin_consent: string; error: string; error_description: string } = event.method === 'POST' ? await readBody(event) : getQuery(event)

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
    if (config.state && (state !== session.data.state)) {
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
      ...config.redirectUri && { redirect_uri: config.redirectUri },
      ...config.scopeInTokenRequest && config.scope && { scope: config.scope.join(' ') },
      ...config.pkce && { code_verifier: session.data.codeVerifier },
      ...(config.authenticationScheme && config.authenticationScheme === 'body') && { client_secret: normalizeURL(config.clientSecret) },
      ...config.additionalTokenParameters && convertObjectToSnakeCase(config.additionalTokenParameters),
    }

    // Make token request
    let tokenResponse: TokenRespose
    try {
      tokenResponse = await ofetch(
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
      logger.error(error?.data ?? error)

      // Handle Microsoft consent_required error
      if (error?.data?.suberror === 'consent_required') {
        const consentUrl = `https://login.microsoftonline.com/${parseURL(config.authorizationUrl).pathname.split('/')[1]}/adminconsent?client_id=${config.clientId}`
        return sendRedirect(
          event,
          consentUrl,
          200,
        )
      }
      return oidcErrorHandler(event, 'Token request failed')
    }

    // Initialize tokens object
    let tokens: Tokens

    // Validate tokens only if audience is matched
    const accessToken = parseJwtToken(tokenResponse.access_token, !!config.skipAccessTokenParsing)
    const idToken = tokenResponse.id_token ? parseJwtToken(tokenResponse.id_token) : undefined
    if ([config.audience as string, config.clientId].some(audience => accessToken.aud?.includes(audience) || idToken?.aud?.includes(audience)) && (config.validateAccessToken || config.validateIdToken)) {
      // Get OIDC configuration
      const openIdConfiguration = (config.openIdConfiguration && typeof config.openIdConfiguration === 'object') ? config.openIdConfiguration : typeof config.openIdConfiguration === 'string' ? await ofetch(config.openIdConfiguration) : await (config.openIdConfiguration!)(config)
      const validationOptions = { jwksUri: openIdConfiguration.jwks_uri as string, issuer: openIdConfiguration.issuer as string, ...config.audience && { audience: config.audience } }

      tokens = {
        accessToken: config.validateAccessToken ? await validateToken(tokenResponse.access_token, validationOptions) : accessToken,
        ...tokenResponse.refresh_token && { refreshToken: tokenResponse.refresh_token },
        ...tokenResponse.id_token && { idToken: config.validateIdToken ? await validateToken(tokenResponse.id_token, validationOptions) : parseJwtToken(tokenResponse.id_token) },
      }
    }
    else {
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
      loggedInAt: timestamp,
      updatedAt: timestamp,
      expireAt: tokens.accessToken.exp || timestamp + useRuntimeConfig().oidc.session.maxAge!,
      provider,
    }

    // Request userinfo
    try {
      if (config.userInfoUrl) {
        const userInfoResult = await ofetch(config.userInfoUrl, {
          headers: {
            Authorization: `${tokenResponse.token_type} ${tokenResponse.access_token}`,
          },
        })
        user.userInfo = config.filterUserInfo ? Object.fromEntries(Object.entries(userInfoResult).filter(([key]) => config.filterUserInfo?.includes(key))) : userInfoResult
      }
    }
    catch {
      logger.warn(`[${provider}] Failed to fetch userinfo`)
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
        exp: accessToken.exp as number,
        iat: accessToken.iat as number,
        accessToken: await encryptToken(tokenResponse.access_token, tokenKey),
        ...tokenResponse.refresh_token && { refreshToken: await encryptToken(tokenResponse.refresh_token, tokenKey) },
        ...tokenResponse.id_token && { idToken: await encryptToken(tokenResponse.id_token, tokenKey) },
      }
      const userSessionId = await getUserSessionId(event)
      await useStorage('oidc').setItem<PersistentSession>(userSessionId, persistentSession)
    }

    await session.clear()
    deleteCookie(event, 'oidc')
    return onSuccess(event, {
      user,
      callbackRedirectUrl: config.callbackRedirectUrl as string,
    })
  })
}

export function logoutEventHandler({ onSuccess }: OAuthConfig<UserSession>) {
  return eventHandler(async (event: H3Event) => {
    // TODO: Is this the best way to get the current provider?
    const provider = event.path.split('/')[2] as ProviderKeys
    const config = configMerger(useRuntimeConfig().oidc.providers[provider] as OidcProviderConfig, providerPresets[provider])

    if (config.logoutUrl) {
      const logoutParams = getQuery(event)
      const logoutRedirectUri = logoutParams.logoutRedirectUri || config.logoutRedirectUri || `${getRequestURL(event).protocol}//${getRequestURL(event).host}`

      // Set logout_hint and id_token_hint dynamic parameters if specified. According to https://openid.net/specs/openid-connect-rpinitiated-1_0.html#RPLogout
      const additionalLogoutParameters: Record<string, string> = config.additionalLogoutParameters || {}
      if (config.additionalLogoutParameters) {
        const userSession = await getUserSession(event)
        Object.keys(config.additionalLogoutParameters).forEach((key) => {
          if (key === 'idTokenHint' && userSession.idToken)
            additionalLogoutParameters[key] = userSession.idToken
          if (key === 'logoutHint' && userSession.claims?.login_hint)
            additionalLogoutParameters[key] = userSession.claims.login_hint as string
        })
      }
      const location = withQuery(config.logoutUrl, {
        ...config.logoutRedirectParameterName && { [config.logoutRedirectParameterName]: logoutRedirectUri },
        ...config.additionalLogoutParameters && convertObjectToSnakeCase(additionalLogoutParameters),
      })
      // Clear session
      await clearUserSession(event)
      return sendRedirect(
        event,
        location,
        200,
      )
    }
    // Clear session
    await clearUserSession(event)
    return onSuccess(event, {
      user: null,
    })
  })
}

export function devEventHandler({ onSuccess }: OAuthConfig<UserSession>) {
  const logger = useOidcLogger()
  return eventHandler(async (event: H3Event) => {
    logger.warn('Using dev auth handler with static auth information')

    const session = await useAuthSession(event)

    // Construct user object
    const timestamp = Math.trunc(Date.now() / 1000) // Use seconds instead of milliseconds to align with JWT
    const user: UserSession = {
      canRefresh: false,
      loggedInAt: timestamp,
      updatedAt: timestamp,
      expireAt: timestamp + 86400, // Adding one day
      provider: 'dev',
      userName: useRuntimeConfig().oidc.devMode?.userName || 'Nuxt OIDC Auth Dev',
      ...useRuntimeConfig().oidc.devMode?.userInfo && { userInfo: useRuntimeConfig().oidc.devMode?.userInfo },
      ...useRuntimeConfig().oidc.devMode?.idToken && { idToken: useRuntimeConfig().oidc.devMode?.idToken },
      ...useRuntimeConfig().oidc.devMode?.accessToken && { accessToken: useRuntimeConfig().oidc.devMode?.accessToken },
      ...useRuntimeConfig().oidc.devMode?.claims && { claims: useRuntimeConfig().oidc.devMode?.claims },
    }

    // Generate JWT dev token - Keys are only used in local dev mode, these are statically generated unsafe keys.
    if (useRuntimeConfig().oidc.devMode?.generateAccessToken) {
      let key
      let alg
      if (useRuntimeConfig().oidc.devMode?.tokenAlgorithm === 'asymmetric') {
        alg = 'RS256'
        const keyPair = await subtle.generateKey(
          {
            name: 'RSASSA-PKCS1-v1_5',
            modulusLength: 2048,
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
            hash: { name: 'SHA-256' },
          },
          true,
          ['sign', 'verify'],
        )
        key = keyPair.privateKey
      }
      else {
        alg = 'HS256'
        key = new TextEncoder().encode(
          generateRandomUrlSafeString(),
        )
      }
      const jwt = await new SignJWT(useRuntimeConfig().oidc.devMode?.claims || {})
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setIssuer(useRuntimeConfig().oidc.devMode?.issuer || 'nuxt:oidc:auth:issuer')
        .setAudience(useRuntimeConfig().oidc.devMode?.audience || 'nuxt:oidc:auth:audience')
        .setExpirationTime('24h')
        .setSubject(useRuntimeConfig().oidc.devMode?.subject || 'nuxt:oidc:auth:subject')
        .sign(key)
      user.accessToken = jwt
    }

    await session.clear()
    deleteCookie(event, 'oidc')

    return onSuccess(event, {
      user,
    })
  })
}

export const oidc = {
  loginEventHandler,
  callbackEventHandler,
  logoutEventHandler,
  devEventHandler,
}
