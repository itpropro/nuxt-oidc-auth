import type { H3Event } from 'h3'
import { H3Error, useSession } from 'h3'
import { eventHandler, createError, getQuery, sendRedirect } from 'h3'
import { withQuery, parseURL, normalizeURL } from 'ufo'
import { ofetch } from 'ofetch'
import { useRuntimeConfig } from '#imports'
import type { OAuthConfig, UserSession, AuthSession, AuthorizationRequest, PkceAuthorizationRequest, TokenRequest, TokenRespose, Providers, OidcProviderConfig, PersistentSession } from '#oidc-auth'
import { validateConfig } from '../utils/config'
import defu from 'defu'
import { generateRandomUrlSafeString, generatePkceVerifier, generatePkceCodeChallenge, parseJwtToken, encryptToken, validateToken } from '../utils/security'
import { genBase64FromString } from 'knitwork'
import * as providerConfigs from '../../../providers'
import type { Tokens } from '~/src/types/session'
import { getUserSessionId, clearUserSession } from '../utils/session'
import { convertObjectToSnakeCase, generateFormDataRequest, oidcErrorHandler } from '../utils/oidc'
import { useLogger } from '@nuxt/kit'

async function useAuthSession(event: H3Event) {
  const session = await useSession<AuthSession>(event, {
    name: 'oidc',
    password: '12345678123456781234567812345678',
    maxAge: 120,
  })
  return session
}

const logger = useLogger('oidc-auth')

export function loginEventHandler({ onError }: OAuthConfig<UserSession>) {
  return eventHandler(async (event: H3Event) => {
    // TODO: Is this the best way to get the current provider?
    const provider = event.path.split('/')[2] as Providers
    const config: OidcProviderConfig = defu(useRuntimeConfig().oidc.providers[provider], providerConfigs[provider])
    const validationResult = validateConfig<Partial<OidcProviderConfig>>(config, config.requiredProperties)
    const validatedConfig = validationResult.config

    if (!validationResult.valid) {
      const error = new H3Error('Invalid configuration')
      logger.error('Missing configuration properties: ', validationResult.missingProperties?.join(', '))
      if (!onError) throw error
      return onError(event, error)
    }

    // Initialize auth session
    const session = await useAuthSession(event)
    await session.update({
      state: generateRandomUrlSafeString(),
      codeVerifier: generatePkceVerifier(),
      redirect: parseURL(event.path).pathname
    })

    const query: AuthorizationRequest | PkceAuthorizationRequest = {
      client_id: validatedConfig.clientId,
      response_type: validatedConfig.responseType,
      scope: Array.from(new Set(validatedConfig.scope)).join(' '),
      state: session.data.state,
      ...validatedConfig.redirectUri && { redirect_uri: validatedConfig.redirectUri },
      ...validatedConfig.pkce && { code_challenge: await generatePkceCodeChallenge(session.data.codeVerifier) },
      ...validatedConfig.pkce && { code_challenge_method: 'S256' },
      ...validatedConfig.additionalAuthParameters && convertObjectToSnakeCase(validatedConfig.additionalAuthParameters)
    }

    // Handling hybrid flows
    if (validatedConfig.responseType.includes('token') || validatedConfig.nonce) {
      const nonce = generateRandomUrlSafeString()
      await session.update({ nonce })
      query.response_mode = 'form_post'
      query.nonce = nonce
      if (!query.scope?.includes('openid'))
        query.scope = `openid ${query.scope}`
    }

    return sendRedirect(
      event,
      withQuery(validatedConfig.authorizationUrl, query),
      200
    )
  })
}

export function callbackEventHandler({ onSuccess, onError }: OAuthConfig<UserSession, Omit<Tokens, 'refreshToken'>>) {
  return eventHandler(async (event: H3Event) => {
    const provider = event.path.split('/')[2] as Providers
    const config: OidcProviderConfig = defu(useRuntimeConfig().oidc.providers[provider], providerConfigs[provider])
    const validationResult = validateConfig<Partial<OidcProviderConfig>>(config, config.requiredProperties)
    const validatedConfig = validationResult.config
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

    // Verify id_token, if available
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
    if (validatedConfig.authenticationScheme === 'header') {
      const encodedCredentials = genBase64FromString(`${validatedConfig.clientId}:${validatedConfig.clientSecret}`)
      headers.authorization = `Basic ${encodedCredentials}`
    }

    // Construct form data for token request
    const requestBody: TokenRequest = {
      client_id: validatedConfig.clientId,
      code,
      redirect_uri: validatedConfig.redirectUri,
      grant_type: validatedConfig.grantType,
      ...validatedConfig.scopeInTokenRequest && { scope: Array.from(new Set(validatedConfig.scope)).join(' ') },
      ...validatedConfig.pkce && { code_verifier: session.data.codeVerifier },
      ...(validatedConfig.authenticationScheme && validatedConfig.authenticationScheme === 'body') && { client_secret: normalizeURL(validatedConfig.clientSecret) },
      ...validatedConfig.additionalTokenParameters && convertObjectToSnakeCase(validatedConfig.additionalTokenParameters),
    }

    const requestForm = generateFormDataRequest(requestBody)

    // Make token request
    let tokenResponse: TokenRespose
    try {
      tokenResponse = await ofetch(
        validatedConfig.tokenUrl,
        {
          method: 'POST',
          headers,
          body: validatedConfig.tokenRequestType === 'json' ? requestBody : requestForm
        }
      )
    } catch (error: any) {
      // Log ofetch error data to console
      logger.error(error.data)

      // Handle Microsoft consent_required error
      if (error.data.suberror === 'consent_required') {
        const consentUrl = `https://login.microsoftonline.com/${parseURL(validatedConfig.authorizationUrl).pathname.split('/')[1]}/adminconsent?client_id=${validatedConfig.clientId}`
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
    const accessToken = parseJwtToken(tokenResponse.access_token)
    if ([validatedConfig.audience || '', validatedConfig.clientId].some((audience) => accessToken.aud?.includes(audience)) && (validatedConfig.validateAccessToken || validatedConfig.validateIdToken)) {
      // Get OIDC configuration
      const openIdConfiguration = typeof validatedConfig.openIdConfiguration === 'object' ? validatedConfig.openIdConfiguration : await validatedConfig.openIdConfiguration(validatedConfig)
      const validationOptions = { jwksUri: openIdConfiguration.jwks_uri as string, issuer: openIdConfiguration.issuer as string }

      tokens = {
        accessToken: validatedConfig.validateAccessToken ? await validateToken(tokenResponse.access_token, validationOptions) : accessToken,
        ...tokenResponse.refresh_token && { refreshToken: tokenResponse.refresh_token },
        ...tokenResponse.id_token && { idToken: validatedConfig.validateIdToken ? await validateToken(tokenResponse.id_token, { jwksUri: openIdConfiguration.jwks_uri as string, issuer: openIdConfiguration.issuer as string }) : parseJwtToken(tokenResponse.id_token) },
      }
    } else {
      tokens = {
        accessToken: accessToken,
        ...tokenResponse.refresh_token && { refreshToken: tokenResponse.refresh_token },
        ...tokenResponse.id_token && { idToken: parseJwtToken(tokenResponse.id_token) },
      }
    }

    // Construct user object
    const timestamp = Math.trunc(Date.now() / 1000) // Use seconds instead of milliseconds to align wih JWT
    const user: UserSession = {
      canRefresh: !!tokens.refreshToken,
      loggedInAt: timestamp,
      updatedAt: timestamp,
      provider,
    }

    // Request userinfo
    try {
      if (validatedConfig.userinfoUrl) {
        const userInfoResult = await ofetch(validatedConfig.userinfoUrl, {
          headers: {
            Authorization: `${tokenResponse.token_type} ${tokenResponse.access_token}`
          }
        })
        user.providerInfo = userInfoResult
      }
    } catch (error) {
      logger.error('Failed to fetch userinfo')
    }

    // Get user name from access token
    if (validatedConfig.userNameClaim) {
      const parsedAccessToken = tokens.accessToken
      user.userName = (validatedConfig.userNameClaim in parsedAccessToken) ? parsedAccessToken[validatedConfig.userNameClaim] as string : ''
    }

    // Get optional claims from id token
    if (validatedConfig.optionalClaims && tokens.idToken) {
      const parsedIdToken = tokens.idToken
      user.claims = {}
      validatedConfig.optionalClaims.forEach(claim => parsedIdToken[claim] && ((user.claims as Record<string, unknown>)[claim] = (parsedIdToken[claim])))
    }

    if (tokenResponse.refresh_token) {
      const tokenKey = process.env.NUXT_OIDC_TOKEN_SECRET as string
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
    const provider = event.path.split('/')[2] as Providers
    const config: OidcProviderConfig = defu(useRuntimeConfig().oidc.providers[provider], providerConfigs[provider])

    // Clear session
    await clearUserSession(event)

    logger.info('Logout Param: ', config.logoutRedirectParameterName, 'Logout URL: ', config.logoutUrl)

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
