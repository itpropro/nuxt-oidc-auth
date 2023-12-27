import { H3Error, useSession, getRequestHeader, eventHandler, createError, getQuery, sendRedirect, readBody } from 'h3'
import { withQuery, parseURL, normalizeURL } from 'ufo'
import { ofetch } from 'ofetch'
// @ts-expect-error - Missing types for nitro exports in Nuxt (useStorage)
import { useRuntimeConfig, useStorage } from '#imports'
import { validateConfig } from '../utils/config'
import { generateRandomUrlSafeString, generatePkceVerifier, generatePkceCodeChallenge, parseJwtToken, encryptToken, validateToken, genBase64FromString } from '../utils/security'
import { getUserSessionId, clearUserSession } from '../utils/session'
import { configMerger, convertObjectToSnakeCase, generateFormDataRequest, oidcErrorHandler } from '../utils/oidc'
import { useLogger } from '@nuxt/kit'
import * as providerPresets from '../../providers'
import type { H3Event } from 'h3'
import type { OAuthConfig } from '../../types/config'
import type { Tokens, UserSession } from '../../types/session'
import type { AuthSession, AuthorizationRequest, OidcProviderConfig, PersistentSession, PkceAuthorizationRequest, ProviderKeys, TokenRequest, TokenRespose } from '../../types/oidc'

async function useAuthSession(event: H3Event) {
  const session = await useSession<AuthSession>(event, {
    name: 'oidc',
    password: process.env.NUXT_OIDC_AUTH_SESSION_SECRET as string,
    maxAge: 120,
  })
  return session
}

const logger = useLogger('oidc-auth')

export function loginEventHandler({ onError }: OAuthConfig<UserSession>) {
  return eventHandler(async (event: H3Event) => {
    // TODO: Is this the best way to get the current provider?
    const provider = event.path.split('/')[2] as ProviderKeys
    const config = configMerger(useRuntimeConfig().oidc.providers[provider] as OidcProviderConfig, providerPresets[provider])
    const validationResult = validateConfig(config, config.requiredProperties)

    if (!validationResult.valid) {
      const error = new H3Error('Invalid configuration')
      logger.error('Missing configuration properties:', validationResult.missingProperties?.join(', '))
      if (!onError) throw error
      return onError(event, error)
    }

    // Initialize auth session
    const session = await useAuthSession(event)
    await session.update({
      state: generateRandomUrlSafeString(),
      codeVerifier: generatePkceVerifier(),
      redirect: getRequestHeader(event, 'referer')
    })

    const query: AuthorizationRequest | PkceAuthorizationRequest = {
      client_id: config.clientId,
      response_type: config.responseType,
      ...config.state && { state: session.data.state },
      ...config.scope && { scope: config.scope.join(' ') },
      ...config.responseMode && { response_mode: config.responseMode },
      ...config.redirectUri && { redirect_uri: config.redirectUri },
      ...config.pkce && { code_challenge: await generatePkceCodeChallenge(session.data.codeVerifier), code_challenge_method: 'S256' },
      ...config.additionalAuthParameters && convertObjectToSnakeCase(config.additionalAuthParameters)
    }

    // Handling hybrid flows
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
      withQuery(config.authorizationUrl, query),
      200
    )
  })
}

export function callbackEventHandler({ onSuccess, onError }: OAuthConfig<UserSession, Omit<Tokens, 'refreshToken'>>) {
  return eventHandler(async (event: H3Event) => {
    const provider = event.path.split('/')[2] as ProviderKeys
    const config = configMerger(useRuntimeConfig().oidc.providers[provider] as OidcProviderConfig, providerPresets[provider])
    const validationResult = validateConfig(config, config.requiredProperties)

    if (!validationResult.valid) {
      const error = new H3Error('Invalid configuration')
      logger.error('Missing configuration properties: ', validationResult.missingProperties?.join(', '))
      if (!onError) throw error
      return onError(event, error)
    }

    const session = await useAuthSession(event)
    // console.log('Callback Session: ', session.data, 'Session ID: ', session.id)

    const { code, state, id_token, admin_consent }: { code: string, state: string, id_token: string, admin_consent: string } = event.method === 'POST' ? await readBody(event) : getQuery(event)

    // Check for admin consent callback
    if (admin_consent) {
      const url = getRequestURL(event)
      sendRedirect(event, `${url.origin}/auth/${provider}/login`, 200)
    }

    // Verify id_token, if available (hybrid flow)
    if (id_token) {
      const parsedIdToken = parseJwtToken(id_token)
      if (parsedIdToken.nonce !== session.data.nonce) {
        oidcErrorHandler(event, 'Nonce mismatch', onError)
      }
    }

    // Check for valid callback
    if (!code || !state) {
      oidcErrorHandler(event, 'Callback failed, missing fields', onError)
    }

    // Check for valid state
    if (state !== session.data.state) {
      oidcErrorHandler(event, 'State mismatch', onError)
    }

    // Construct request header object
    const headers: HeadersInit = {}

    // Validate if authentication information should be send in header or body
    if (config.authenticationScheme === 'header') {
      const encodedCredentials = genBase64FromString(`${config.clientId}:${config.clientSecret}`)
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

    const requestForm = generateFormDataRequest(requestBody)

    // Make token request
    let tokenResponse: TokenRespose
    try {
      tokenResponse = await ofetch(
        config.tokenUrl,
        {
          method: 'POST',
          headers,
          body: config.tokenRequestType === 'json' ? requestBody : requestForm
        }
      )
    } catch (error: any) {
      // Log ofetch error data to console
      logger.error(error.data)

      // Handle Microsoft consent_required error
      if (error.data.suberror === 'consent_required') {
        const consentUrl = `https://login.microsoftonline.com/${parseURL(config.authorizationUrl).pathname.split('/')[1]}/adminconsent?client_id=${config.clientId}`
        return sendRedirect(
          event,
          consentUrl,
          200
        )
      }
      const h3Error = createError({
        statusCode: 401,
        message: 'Token request failed',
      })
      if (!onError) throw h3Error
      return onError(event, h3Error)
    }

    // Initialize tokens object
    let tokens: Tokens

    // Validate tokens only if audience is matched
    const accessToken = parseJwtToken(tokenResponse.access_token, !!config.skipAccessTokenParsing)
    if ([config.audience || '', config.clientId].some((audience) => accessToken.aud?.includes(audience)) && (config.validateAccessToken || config.validateIdToken)) {
      // Get OIDC configuration
      const openIdConfiguration = (config.openIdConfiguration && typeof config.openIdConfiguration === 'object') ? config.openIdConfiguration : await (config.openIdConfiguration as Function)(config)
      const validationOptions = { jwksUri: openIdConfiguration.jwks_uri as string, issuer: openIdConfiguration.issuer as string }

      tokens = {
        accessToken: config.validateAccessToken ? await validateToken(tokenResponse.access_token, validationOptions) : accessToken,
        ...tokenResponse.refresh_token && { refreshToken: tokenResponse.refresh_token },
        ...tokenResponse.id_token && { idToken: config.validateIdToken ? await validateToken(tokenResponse.id_token, { jwksUri: openIdConfiguration.jwks_uri as string, issuer: openIdConfiguration.issuer as string }) : parseJwtToken(tokenResponse.id_token) },
      }
    } else {
      tokens = {
        accessToken: accessToken,
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
      provider,
    }

    // Request userinfo
    try {
      if (config.userinfoUrl) {
        const userInfoResult = await ofetch(config.userinfoUrl, {
          headers: {
            Authorization: `${tokenResponse.token_type} ${tokenResponse.access_token}`
          }
        })
        user.providerInfo = config.filterUserinfo ? Object.fromEntries(Object.entries(userInfoResult).filter(([key]) => config.filterUserinfo?.includes(key))) : userInfoResult
      }
    } catch (error) {
      logger.warn(`[${provider}] Failed to fetch userinfo`)
    }

    // Get user name from access token
    if (config.userNameClaim) {
      const parsedAccessToken = tokens.accessToken
      user.userName = (config.userNameClaim in parsedAccessToken) ? parsedAccessToken[config.userNameClaim] as string : ''
    }

    // Get optional claims from id token
    if (config.optionalClaims && tokens.idToken) {
      const parsedIdToken = tokens.idToken
      user.claims = {}
      config.optionalClaims.forEach(claim => parsedIdToken[claim] && ((user.claims as Record<string, unknown>)[claim] = (parsedIdToken[claim])))
    }

    if (tokenResponse.refresh_token) {
      const tokenKey = process.env.NUXT_OIDC_TOKEN_KEY as string
      const persistentSession: PersistentSession = {
        exp: accessToken.exp as number,
        iat: accessToken.iat as number,
        accessToken: await encryptToken(tokenResponse.access_token, tokenKey),
        refreshToken: await encryptToken(tokenResponse.refresh_token, tokenKey)
      }
      const userSessionId = await getUserSessionId(event)
      await useStorage('oidc').setItem<PersistentSession>(userSessionId, persistentSession)
    }

    return onSuccess(event, {
      user,
      tokens
    })
  })
}

export function logoutEventHandler({ onSuccess }: OAuthConfig<UserSession>) {
  return eventHandler(async (event: H3Event) => {
    // TODO: Is this the best way to get the current provider?
    const provider = event.path.split('/')[2] as ProviderKeys
    const config = configMerger(useRuntimeConfig().oidc.providers[provider] as OidcProviderConfig, providerPresets[provider])

    // Clear session
    await clearUserSession(event)

    // logger.info('Logout Param: ', config.logoutRedirectParameterName, 'Logout URL: ', config.logoutUrl)

    if (config.logoutUrl) {
      return sendRedirect(
        event,
        withQuery(config.logoutUrl, { ...config.logoutRedirectParameterName && { [config.logoutRedirectParameterName]: `${getRequestURL(event).protocol}//${getRequestURL(event).host}` }, }),
        200
      )
    }
    return onSuccess(event, {
      user: {},
      tokens: {}
    })
  })
}

export const oidc = {
  loginEventHandler,
  callbackEventHandler,
  logoutEventHandler,
}
