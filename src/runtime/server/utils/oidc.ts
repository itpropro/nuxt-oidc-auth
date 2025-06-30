import type { H3Event } from 'h3'
import type { RefreshTokenRequest, TokenRequest, TokenRespose, UserSession } from '../../types'
import { createConsola } from 'consola'
import { createDefu } from 'defu'
import { sendRedirect } from 'h3'
import { snakeCase } from 'scule'
import { normalizeURL } from 'ufo'
import { textToBase64 } from 'undio'
import { createProviderFetch, type OidcProviderConfig } from './provider'
import { parseJwtToken } from './security'
import { clearUserSession } from './session'

export function useOidcLogger() {
  return createConsola().withDefaults({ tag: 'nuxt-oidc-auth', message: '[nuxt-oidc-auth]:' })
}

// Custom defu config merger to replace default values instead of merging them, except for requiredProperties
export const configMerger = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key]) && Array.isArray(value)) {
    obj[key] = key === 'requiredProperties' ? Array.from(new Set(obj[key].concat(value))) : value as any
    return true
  }
})

export async function refreshAccessToken(refreshToken: string, config: OidcProviderConfig, tokenUrl: string) {
  const logger = useOidcLogger()
  const customFetch = await createProviderFetch(config)
  // Construct request header object
  const headers: HeadersInit = {}

  // Validate if authentication information should be send in header or body
  if (config.authenticationScheme === 'header') {
    const encodedCredentials = textToBase64(`${config.clientId}:${config.clientSecret}`, { dataURL: false })
    headers.authorization = `Basic ${encodedCredentials}`
  }

  // Construct form data for refresh token request
  const requestBody: RefreshTokenRequest = {
    client_id: config.clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    ...(config.scopeInTokenRequest && config.scope) && { scope: config.excludeOfflineScopeFromTokenRequest ? config.scope.filter(s => s !== 'offline_access').join(' ') : config.scope.join(' ') },
    ...(config.authenticationScheme === 'body') && { client_secret: normalizeURL(config.clientSecret) },
  }
  // Make refresh token request
  let tokenResponse: TokenRespose
  try {
    tokenResponse = await customFetch(
      tokenUrl,
      {
        method: 'POST',
        headers,
        body: convertTokenRequestToType(requestBody, config.tokenRequestType),
      },
    )
  }
  catch (error: any) {
    throw new Error(error?.data ? `${error.data.error}: ${error.data.error_description}` : error)
  }

  // Construct tokens object
  const tokens: Record<'refreshToken' | 'accessToken' | 'idToken', string> = {
    refreshToken: tokenResponse.refresh_token || refreshToken,
    accessToken: tokenResponse.access_token,
    idToken: tokenResponse.id_token || '',
  }

  const accessToken = parseJwtToken(tokenResponse.access_token, !!config.skipAccessTokenParsing)

  // Construct user object
  const user: Omit<UserSession, 'provider'> = {
    canRefresh: !!tokens.refreshToken,
    updatedAt: Math.trunc(Date.now() / 1000), // Use seconds instead of milliseconds to align wih JWT
    expireAt: accessToken.exp || Math.trunc(Date.now() / 1000) + 3600, // Fallback 60 min
  }

  // Update optional claims
  if (config.optionalClaims && tokenResponse.id_token) {
    const parsedIdToken = parseJwtToken(tokenResponse.id_token)
    user.claims = {}
    config.optionalClaims.forEach(claim => parsedIdToken[claim] && ((user.claims as Record<string, unknown>)[claim] = (parsedIdToken[claim])))
  }

  logger.info('Successfully refreshed token')

  return {
    user,
    tokens,
    expiresIn: tokenResponse.expires_in,
    parsedAccessToken: accessToken,
  }
}

export function generateFormDataRequest(requestValues: RefreshTokenRequest | TokenRequest) {
  const requestBody = new FormData()
  Object.keys(requestValues).forEach((key) => {
    requestBody.append(key, normalizeURL(requestValues[key as keyof typeof requestValues] as string))
  })
  return requestBody
}

export function generateFormUrlEncodedRequest(requestValues: RefreshTokenRequest | TokenRequest) {
  const requestBody = new URLSearchParams()
  Object.entries(requestValues).forEach((key) => {
    if (typeof key[1] === 'string')
      requestBody.append(key[0], normalizeURL(key[1]))
  })
  return requestBody
}

export function convertTokenRequestToType(
  requestValues: RefreshTokenRequest | TokenRequest,
  requestType: OidcProviderConfig['tokenRequestType'] = 'form',
) {
  switch (requestType) {
    case 'json':
      return requestValues
    case 'form-urlencoded':
      return generateFormUrlEncodedRequest(requestValues)
    default:
      return generateFormDataRequest(requestValues)
  }
}

export function convertObjectToSnakeCase(object: Record<string, any>) {
  return Object.entries(object).reduce((acc, [key, value]) => {
    acc[snakeCase(key)] = value
    return acc
  }, {} as Record<string, any>)
}

export async function oidcErrorHandler(event: H3Event, errorText: string, errorCode: number = 500) {
  const logger = useOidcLogger()
  await clearUserSession(event, true)
  logger.error(errorText, '- Code:', errorCode)
  return sendRedirect(
    event,
    '/',
    302,
  )
}
