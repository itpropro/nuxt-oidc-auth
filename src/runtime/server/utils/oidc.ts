import type {
  RefreshTokenRequest,
  TokenRequest,
  TokenRespose,
  Tokens,
  UserSession,
} from '../../types'
import type { H3Event } from 'h3'
import type { OidcProviderConfig } from './provider'
import type { IdTokenContinuityClaims } from './token-validation'
import { createConsola } from 'consola'
import { sendRedirect } from 'h3'
import { createProviderFetch } from './provider'
import { withAppBase } from './redirect'
import { textToBase64 } from './encoding'
import { parseJwtToken } from './security'
import { clearUserSession } from './session'
import { snakeCase } from './string'
import { validateTokenResponse } from './token-validation'

export function useOidcLogger() {
  return createConsola().withDefaults({ tag: 'nuxt-oidc-auth', message: '[nuxt-oidc-auth]:' })
}

export async function refreshAccessToken(
  refreshToken: string,
  config: OidcProviderConfig,
  expectedIdTokenClaims?: IdTokenContinuityClaims,
) {
  const logger = useOidcLogger()
  const customFetch = await createProviderFetch(config)
  // Construct request header object
  const headers: HeadersInit = {}

  // Validate if authentication information should be send in header or body
  if (config.authenticationScheme === 'header') {
    const encodedCredentials = textToBase64(`${config.clientId}:${config.clientSecret}`)
    headers.authorization = `Basic ${encodedCredentials}`
  }

  // Construct form data for refresh token request
  const requestBody: RefreshTokenRequest = {
    client_id: config.clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    ...(config.scopeInTokenRequest &&
      config.scope && {
        scope: config.excludeOfflineScopeFromTokenRequest
          ? config.scope.filter((s) => s !== 'offline_access').join(' ')
          : config.scope.join(' '),
      }),
    ...(config.authenticationScheme === 'body' && {
      client_secret: config.clientSecret,
    }),
  }
  // Make refresh token request
  let tokenResponse: TokenRespose
  try {
    tokenResponse = await customFetch(config.tokenUrl, {
      method: 'POST',
      headers,
      body: convertTokenRequestToType(requestBody, config.tokenRequestType),
    })
  } catch (error: unknown) {
    throw new Error(formatTokenRequestError(error, config.clientSecret))
  }

  // Construct tokens object
  const tokens: Record<'refreshToken' | 'accessToken' | 'idToken', string> = {
    refreshToken: tokenResponse.refresh_token || refreshToken,
    accessToken: tokenResponse.access_token,
    idToken: tokenResponse.id_token || '',
  }

  const accessToken = parseJwtToken(tokenResponse.access_token, !!config.skipAccessTokenParsing)
  const idToken =
    tokenResponse.id_token && (config.tokenValidationMode === 'strict' || !!config.optionalClaims)
      ? parseJwtToken(tokenResponse.id_token)
      : undefined
  let parsedTokens: Tokens
  if (config.tokenValidationMode === 'strict') {
    parsedTokens = (
      await validateTokenResponse({
        accessToken,
        config,
        customFetch,
        expectedIdTokenClaims,
        idToken,
        tokenResponse,
      })
    ).tokens
  } else {
    parsedTokens = {
      accessToken,
      ...(idToken && { idToken }),
      ...(tokenResponse.refresh_token && { refreshToken: tokenResponse.refresh_token }),
    }
  }

  // Construct user object
  const user: Omit<UserSession, 'provider' | 'expireAt'> & Partial<Pick<UserSession, 'expireAt'>> =
    {
      canRefresh: !!tokens.refreshToken,
      updatedAt: Math.trunc(Date.now() / 1000), // Use seconds instead of milliseconds to align wih JWT
      ...(parsedTokens.accessToken.exp !== undefined && {
        expireAt: parsedTokens.accessToken.exp,
      }),
    }

  // Update optional claims
  if (config.optionalClaims && parsedTokens.idToken) {
    const parsedIdToken = parsedTokens.idToken
    user.claims = {}
    config.optionalClaims.forEach((claim) => {
      if (parsedIdToken[claim]) {
        ;(user.claims as Record<string, unknown>)[claim] = parsedIdToken[claim]
      }
    })
  }

  logger.info('Successfully refreshed token')

  return {
    user,
    tokens,
    expiresIn: tokenResponse.expires_in,
    parsedAccessToken: parsedTokens.accessToken,
  }
}

export function generateFormDataRequest(requestValues: RefreshTokenRequest | TokenRequest) {
  const requestBody = new FormData()
  Object.keys(requestValues).forEach((key) => {
    requestBody.append(key, requestValues[key as keyof typeof requestValues] as string)
  })
  return requestBody
}

export function generateFormUrlEncodedRequest(requestValues: RefreshTokenRequest | TokenRequest) {
  const requestBody = new URLSearchParams()
  Object.entries(requestValues).forEach((key) => {
    if (typeof key[1] === 'string') requestBody.append(key[0], key[1])
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

export function convertObjectToSnakeCase<T>(object: Record<string, T>) {
  return Object.entries(object).reduce(
    (acc, [key, value]) => {
      acc[snakeCase(key)] = value
      return acc
    },
    {} as Record<string, T>,
  )
}

function stringifyTokenRequestError(error: unknown): string {
  try {
    if (error && typeof error === 'object' && 'data' in error) {
      const data: unknown = error.data
      if (data && typeof data === 'object' && ('error' in data || 'error_description' in data)) {
        const code = 'error' in data ? String(data.error) : 'undefined'
        const description =
          'error_description' in data ? String(data.error_description) : 'undefined'
        return `${code}: ${description}`
      }
    }

    if (error instanceof Error) return error.message
    if (error && typeof error === 'object') {
      return JSON.stringify(error) || 'Unknown token request error'
    }
    return String(error)
  } catch {
    return 'Unknown token request error'
  }
}

export function formatTokenRequestError(error: unknown, clientSecret: string): string {
  const message = stringifyTokenRequestError(error)

  if (!clientSecret) return message

  const encodedSecrets = new Set([clientSecret])
  const encodeSecretVariants = [
    () => encodeURIComponent(clientSecret),
    () => new URLSearchParams({ value: clientSecret }).toString().slice('value='.length),
  ]
  for (const encodeSecret of encodeSecretVariants) {
    try {
      encodedSecrets.add(encodeSecret())
    } catch {
      continue
    }
  }

  return [...encodedSecrets]
    .sort((a, b) => b.length - a.length)
    .reduce((redacted, secret) => redacted.replaceAll(secret, '[REDACTED]'), message)
}

export async function oidcErrorHandler(event: H3Event, errorText: string, errorCode: number = 500) {
  const logger = useOidcLogger()
  await clearUserSession(event, true)
  logger.error(errorText, '- Code:', errorCode)
  return sendRedirect(event, withAppBase('/'), 302)
}
