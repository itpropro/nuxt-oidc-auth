import type { H3Event } from 'h3'
import { H3Error, useSession } from 'h3'
import { eventHandler, createError, getQuery, sendRedirect } from 'h3'
import { withQuery, parseURL, normalizeURL } from 'ufo'
import { ofetch } from 'ofetch'
import { useRuntimeConfig } from '#imports'
import type { OAuthConfig, UserSession, AuthSession, OAuthOidcConfig, AuthorizationRequest, PkceAuthorizationRequest, TokenRequest, TokenRespose, Providers, OidcProviderConfig } from '#oidc-auth'
import { validateConfig } from '../utils/config'
import defu from 'defu'
import { generateRandomUrlSafeString, generatePkceVerifier, generatePkceCodeChallenge, parseJwtToken, encryptRefreshToken, type EncryptedRefreshToken } from '../utils/security'
import { genBase64FromString } from 'knitwork'
import * as providerConfigs from '../../../providers'
import type { Tokens } from '~/src/types/session'
import { getUserSessionId } from '../utils/session'
import { convertObjectToSnakeCase, generateFormDataRequest, oidcErrorHandler } from '../utils/oidc'

async function useAuthSession(event: H3Event) {
  const session = await useSession<AuthSession>(event, {
    name: 'oidc',
    password: '12345678123456781234567812345678',
    maxAge: 120,
  })
  return session
}

export function loginEventHandler({ onError }: OAuthConfig<UserSession>) {
  return eventHandler(async (event: H3Event) => {
    // TODO: Is this the best way to get the current provider?
    const provider = event.path.split('/')[2] as Providers
    const config: OidcProviderConfig = defu(useRuntimeConfig().oidc.providers[provider], providerConfigs[provider])
    const validationResult = validateConfig<Partial<OidcProviderConfig>>(config, config.requiredProperties)
    const validatedConfig = validationResult.config

    if (!validationResult.valid) {
      const error = new H3Error('Invalid configuration')
      console.error('Missing configuration properties: ', validationResult.missingProperties?.join(', '))
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
      redirect_uri: validatedConfig.redirectUri,
      scope: Array.from(new Set(validatedConfig.scope)).join(' '),
      state: session.data.state,
      ...validatedConfig.pkce && { code_challenge: await generatePkceCodeChallenge(session.data.codeVerifier) },
      ...validatedConfig.pkce && { code_challenge_method: 'S256' },
      ...validatedConfig.responseMode && { response_mode: validatedConfig.responseMode },
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

export function callbackEventHandler({ onSuccess, onError }: OAuthConfig<UserSession, Tokens>) {
  return eventHandler(async (event: H3Event) => {
    const provider = event.path.split('/')[2] as Providers
    const config: OidcProviderConfig = defu(useRuntimeConfig().oidc.providers[provider], providerConfigs[provider])
    const validationResult = validateConfig<Partial<OidcProviderConfig>>(config, [
      'clientId',
      'clientSecret',
      'authorizationUrl',
      'tokenUrl',
      'redirectUri',
    ])
    const validatedConfig = validationResult.config
    if (!validationResult.valid) {
      const error = new H3Error('Invalid configuration')
      console.error('Missing configuration properties: ', validationResult.missingProperties?.join(', '))
      if (!onError) throw error
      return onError(event, error)
    }

    const session = await useAuthSession(event)
    // console.log('Callback Session: ', session.data, 'Session ID: ', session.id)

    if (parseURL(event.node.req.url).pathname === parseURL(validatedConfig.redirectUri).pathname) {
      const { code, state, id_token, admin_consent }: { code: string, state: string, id_token: string, admin_consent: string } = event.method === 'POST' ? await readBody(event) : getQuery(event)

      // Check for admin consent callback
      if (admin_consent) {
        const url = getRequestURL(event)
        sendRedirect(event, `${url.origin}/auth/${provider}/login`, 200)
      }

      // Verify id_token, if available
      if (id_token) {
        const parsedIdToken = parseJwtToken(id_token)
        if (parsedIdToken.payload.nonce !== session.data.nonce) {
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
        console.error(error.data)

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

      // Validate tokens
      // TODO: Validate id_token and access_token

      // Construct tokens object
      const tokens: Tokens = {
        access_token: tokenResponse.access_token,
        ...tokenResponse.refresh_token && { refresh_token: tokenResponse.refresh_token },
        ...tokenResponse.id_token && { id_token: tokenResponse.id_token },
      }

      // Construct user object
      const timestamp = Date.now()
      const user: UserSession = {
        canRefresh: !!tokens.refresh_token,
        loggedInAt: timestamp,
        updatedAt: timestamp,
        provider,
      }

      // Request userinfo
      try {
        if (validatedConfig.userinfoUrl) {
          const userInfoResult = await ofetch(validatedConfig.userinfoUrl, {
            headers: {
              Authorization: `${tokenResponse.token_type} ${tokens.access_token}`
            }
          })
          user.providerInfo = userInfoResult
        }
      } catch (error) {
        console.error('Failed to fetch userinfo')
      }

      // Get user name from access token
      if (validatedConfig.userNameClaim) {
        const parsedAccessToken = parseJwtToken(tokens.access_token)
        user.userName = (validatedConfig.userNameClaim in parsedAccessToken.payload) ? parsedAccessToken.payload[validatedConfig.userNameClaim] as string : ''
      }

      // Get optional claims from id token
      if (validatedConfig.optionalClaims && tokens.id_token) {
        const parsedIdToken = parseJwtToken(tokens.id_token)
        user.claims = []
        validatedConfig.optionalClaims.forEach(claim => parsedIdToken.payload[claim] && user.claims?.push(parsedIdToken.payload[claim] as string))
      }

      if (tokens.refresh_token) {
        const refreshTokenKey = useRuntimeConfig().oidc.session.refreshTokenSecret as string
        const encryptedRefreshToken = await encryptRefreshToken(tokens.refresh_token, refreshTokenKey)
        const userSessionId = await getUserSessionId(event)
        await useStorage('oidc').setItem<EncryptedRefreshToken>(userSessionId, encryptedRefreshToken)
      }

      return onSuccess(event, {
        user,
        tokens
      })
    }
  })
}

export function logoutEventHandler({ onSuccess }: OAuthConfig<UserSession>) {
  return eventHandler(async (event: H3Event) => {
    // TODO: Is this the best way to get the current provider?
    const provider = event.path.split('/')[2] as Providers
    const config: OidcProviderConfig = defu(useRuntimeConfig().oidc.providers[provider], providerConfigs[provider])

    if (config.logoutUrl) {
      return sendRedirect(
        event,
        withQuery(config.logoutUrl, { ...config.logoutRedirectParameterName && { [config.logoutRedirectParameterName]: getRequestURL(event).host }, }),
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
