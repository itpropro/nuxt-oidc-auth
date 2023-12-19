import { ofetch } from 'ofetch'
import type { OidcProviderConfig, Providers, RefreshTokenRequest, RemoveOptionalProps, TokenRequest, TokenRespose, UserSession } from '~/src/types'
import { genBase64FromString } from 'knitwork'
import defu from 'defu'
import { snakeCase } from 'scule'
import { normalizeURL } from 'ufo'
import * as providerConfigs from '../../../providers'
import type { H3Event, H3Error } from 'h3'

export async function refreshAccessToken(provider: Providers, refreshToken: string) {
  const validatedConfig = defu(useRuntimeConfig().oidc.providers[provider], providerConfigs[provider]) as RemoveOptionalProps<OidcProviderConfig>

  // Construct request header object
  const headers: HeadersInit = {}

  // Validate if authentication information should be send in header or body
  if (validatedConfig.authenticationScheme === 'header') {
    const encodedCredentials = genBase64FromString(`${validatedConfig.clientId}:${validatedConfig.clientSecret}`)
    headers.authorization = `Basic ${encodedCredentials}`
  }

  // Construct form data for refresh token request
  const requestBody: RefreshTokenRequest = {
    client_id: validatedConfig.clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    ...validatedConfig.scopeInTokenRequest && { scope: Array.from(new Set(validatedConfig.scope)).join(' ') },
    ...(validatedConfig.authenticationScheme === 'body') && { client_secret: normalizeURL(validatedConfig.clientSecret) }
  }
  const requestForm = generateFormDataRequest(requestBody)

  // Make refresh token request
  let tokenResponse: TokenRespose
  try {
    tokenResponse = await ofetch(
      validatedConfig.tokenUrl,
      {
        method: 'POST',
        headers,
        body: validatedConfig.tokenRequestType === 'json' ? requestBody : requestForm,
      }
    )
  } catch (error: any) {
    console.error(error.data) // Log ofetch error data to console
    throw new Error('Failed to refresh token')
  }

  // Construct tokens object
  const tokens = {
    access_token: tokenResponse.access_token,
    ...tokenResponse.refresh_token && { refresh_token: tokenResponse.refresh_token },
    ...tokenResponse.id_token && { id_token: tokenResponse.id_token },
  }

  // Construct user object
  const user: UserSession = {
    canRefresh: !!tokenResponse.refresh_token,
    updatedAt: Date.now(),
  }

  return {
    user,
    tokens
  }
}

export function generateFormDataRequest(requestValues: RefreshTokenRequest | TokenRequest) {
  const requestBody = new FormData()
  Object.keys(requestValues).forEach((key) => {
    requestBody.append(key, normalizeURL(requestValues[(key as keyof typeof requestValues)] as string))
  })
  return requestBody
}

export function convertObjectToSnakeCase(object: Record<string, any>) {
  return Object.entries(object).reduce((acc, [key, value]) => {
    acc[snakeCase(key)] = value
    return acc
  }, {} as Record<string, any>)
}

export function oidcErrorHandler(event: H3Event, errorText: string, onError?: ((event: H3Event, error: H3Error) => void | Promise<void>), errorCode: number = 401) {
  const h3Error = createError({
    statusCode: errorCode,
    message: errorText,
  })
  if (!onError) throw h3Error
  return onError(event, h3Error)
}
