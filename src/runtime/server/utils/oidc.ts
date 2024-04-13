import { createError } from 'h3'
import { ofetch } from 'ofetch'
import { snakeCase } from 'scule'
import { normalizeURL } from 'ufo'
import { genBase64FromString, parseJwtToken } from './security'
import { createDefu } from 'defu'
import { createConsola } from 'consola'
import type { H3Event, H3Error } from 'h3'
import type { OidcProviderConfig, RefreshTokenRequest, TokenRequest, TokenRespose } from '../../types/oidc'
import type { UserSession } from '../../types/session'

export const useOidcLogger = () => {
  return createConsola().withDefaults({ tag: 'nuxt-oidc-auth', message: '[nuxt-oidc-auth]:' })
}

// Custom defu config merger to replace default values instead of merging them, except for requiredProperties
export const configMerger = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key]) && Array.isArray(value)) {
    obj[key] = key === 'requiredProperties' ? Array.from(new Set(obj[key].concat(value))) : value as any
    return true
  }
})

export async function refreshAccessToken(refreshToken: string, config: OidcProviderConfig) {
  const logger = useOidcLogger()
  // Construct request header object
  const headers: HeadersInit = {}

  // Validate if authentication information should be send in header or body
  if (config.authenticationScheme === 'header') {
    const encodedCredentials = genBase64FromString(`${config.clientId}:${config.clientSecret}`)
    headers.authorization = `Basic ${encodedCredentials}`
  }
  
  // Set Content-Type header
  headers['content-type'] = getTokenRequestContentType(config.tokenRequestType)

  // Construct form data for refresh token request
  const requestBody: RefreshTokenRequest = {
    client_id: config.clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    ...(config.scopeInTokenRequest && config.scope) && { scope: config.scope.join(' ') },
    ...(config.authenticationScheme === 'body') && { client_secret: normalizeURL(config.clientSecret) }
  }

  // Make refresh token request
  let tokenResponse: TokenRespose
  try {
    tokenResponse = await ofetch(
      config.tokenUrl,
      {
        method: 'POST',
        headers,
        body: convertTokenRequestToType(requestBody, config.tokenRequestType)
      }
    )
  } catch (error: any) {
    logger.error(error?.data ?? error) // Log ofetch error data to console
    throw new Error('Failed to refresh token')
  }

  // Construct tokens object
  const tokens: Record<'refreshToken' | 'accessToken', string> = {
    refreshToken: tokenResponse.refresh_token as string,
    accessToken: tokenResponse.access_token,
  }

  // Construct user object
  const user: UserSession = {
    canRefresh: !!tokenResponse.refresh_token,
    updatedAt: Math.trunc(Date.now() / 1000), // Use seconds instead of milliseconds to align wih JWT
    expireAt: parseJwtToken(tokenResponse.access_token).exp,
  }

  // Update optional claims
  if (config.optionalClaims && tokenResponse.id_token) {
    const parsedIdToken = parseJwtToken(tokenResponse.id_token)
    user.claims = {}
    config.optionalClaims.forEach(claim => parsedIdToken[claim] && ((user.claims as Record<string, unknown>)[claim] = (parsedIdToken[claim])))
  }

  // Expose tokens
  if (config.exposeAccessToken)
    user.accessToken = tokenResponse.access_token

  if (config.exposeIdToken)
    user.idToken = tokenResponse.id_token

  return {
    user,
    tokens,
    expiresIn: tokenResponse.expires_in,
  }
}

export function generateFormDataRequest(requestValues: RefreshTokenRequest | TokenRequest) {
  const requestBody = new FormData()
  Object.keys(requestValues).forEach((key) => {
    requestBody.append(key, normalizeURL(requestValues[(key as keyof typeof requestValues)] as string))
  })
  return requestBody
}

export function generateFormUrlEncodedRequest(requestValues: RefreshTokenRequest | TokenRequest) {
  const requestEntries = Object.entries(requestValues).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  return new URLSearchParams(requestEntries).toString()
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

export function getTokenRequestContentType(
  requestType: OidcProviderConfig['tokenRequestType'] = 'form',
) {
  return (
    {
      json: 'application/json',
      form: 'multipart/form-data',
      'form-urlencoded': 'application/x-www-form-urlencoded',
    }[requestType]
  )
}

export function convertObjectToSnakeCase(object: Record<string, any>) {
  return Object.entries(object).reduce((acc, [key, value]) => {
    acc[snakeCase(key)] = value
    return acc
  }, {} as Record<string, any>)
}

export function oidcErrorHandler(event: H3Event, errorText: string, onError?: ((event: H3Event, error: H3Error) => void | Promise<void>), errorCode: number = 500) {
  const h3Error = createError({
    statusCode: errorCode,
    message: errorText,
  })
  if (!onError) throw h3Error
  return onError(event, h3Error)
}
