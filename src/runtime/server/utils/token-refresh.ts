import type {
  RefreshTokenRequest,
  TokenRequest,
  TokenRespose,
  Tokens,
  UserSession,
} from '../../types'
import { textToBase64 } from './encoding'
import { useOidcLogger } from './logger'
import type { OidcProviderConfig } from './provider'
import {
  createProviderFetch,
  isProviderTimeout,
  isProviderUnavailable,
  ProviderUnavailableError,
} from './provider'
import { parseJwtToken } from './security'
import { snakeCase } from './string'
import type { IdTokenContinuityClaims } from './token-validation'
import { validateTokenResponse } from './token-validation'

export async function refreshAccessToken(
  refreshToken: string,
  config: OidcProviderConfig,
  expectedIdTokenClaims?: IdTokenContinuityClaims,
): Promise<{
  user: Omit<UserSession, 'provider' | 'expireAt'> & Partial<Pick<UserSession, 'expireAt'>>
  tokens: Record<'refreshToken' | 'accessToken' | 'idToken', string>
  expiresIn: TokenRespose['expires_in']
  parsedAccessToken: Tokens['accessToken']
}> {
  const logger = useOidcLogger()
  const customFetch = await createProviderFetch(config)
  // Construct request header object
  const headers: HeadersInit = {}

  // Validate if authentication information should be send in header or body
  if (config.authenticationScheme === 'header') {
    const encodedCredentials = textToBase64(`${config.clientId}:${config.clientSecret}`)
    headers['authorization'] = `Basic ${encodedCredentials}`
  }

  // Construct form data for refresh token request
  const requestBody: RefreshTokenRequest = {
    client_id: config.clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    ...(Boolean(config.scopeInTokenRequest) &&
      config.scope && {
        scope:
          config.excludeOfflineScopeFromTokenRequest === true
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
    const message = formatTokenRequestError(error, config.clientSecret)
    // The raw fetch error can contain credentials; only the redacted message may leave this boundary.
    throw isProviderUnavailable(error)
      ? new ProviderUnavailableError(message, isProviderTimeout(error))
      : new Error(message)
  }

  // Construct tokens object
  const tokens: Record<'refreshToken' | 'accessToken' | 'idToken', string> = {
    refreshToken:
      tokenResponse.refresh_token !== undefined && tokenResponse.refresh_token !== ''
        ? tokenResponse.refresh_token
        : refreshToken,
    accessToken: tokenResponse.access_token,
    idToken: tokenResponse.id_token ?? '',
  }

  const accessToken = parseJwtToken(
    tokenResponse.access_token,
    Boolean(config.skipAccessTokenParsing),
  )
  const idToken =
    tokenResponse.id_token !== undefined &&
    tokenResponse.id_token !== '' &&
    (config.tokenValidationMode === 'strict' || Boolean(config.optionalClaims))
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
      ...(Boolean(tokenResponse.refresh_token) && { refreshToken: tokenResponse.refresh_token }),
    }
  }

  // Construct user object
  const user: Omit<UserSession, 'provider' | 'expireAt'> & Partial<Pick<UserSession, 'expireAt'>> =
    {
      canRefresh: Boolean(tokens.refreshToken),
      updatedAt: Math.trunc(Date.now() / 1000),
      ...(parsedTokens.accessToken.exp !== undefined && {
        expireAt: parsedTokens.accessToken.exp,
      }),
    }

  // Update optional claims
  if (config.optionalClaims && parsedTokens.idToken) {
    const parsedIdToken = parsedTokens.idToken
    user.claims = {}
    for (const claim of config.optionalClaims) {
      const value = parsedIdToken[claim]
      const hasValue = Boolean(value)
      if (hasValue) {
        user.claims[claim] = value
      }
    }
  }

  logger.info('Successfully refreshed token')

  return {
    user,
    tokens,
    expiresIn: tokenResponse.expires_in,
    parsedAccessToken: parsedTokens.accessToken,
  }
}

export function generateFormDataRequest(
  requestValues: RefreshTokenRequest | TokenRequest,
): FormData {
  const requestBody = new FormData()
  for (const [key, value] of Object.entries(requestValues)) {
    requestBody.append(key, String(value))
  }
  return requestBody
}

export function generateFormUrlEncodedRequest(
  requestValues: RefreshTokenRequest | TokenRequest,
): URLSearchParams {
  const requestBody = new URLSearchParams()
  for (const [key, value] of Object.entries(requestValues)) {
    if (typeof value === 'string') {
      requestBody.append(key, value)
    }
  }
  return requestBody
}

export function convertTokenRequestToType(
  requestValues: RefreshTokenRequest | TokenRequest,
  requestType: OidcProviderConfig['tokenRequestType'] = 'form',
): RefreshTokenRequest | TokenRequest | URLSearchParams | FormData {
  switch (requestType) {
    case 'json': {
      return requestValues
    }
    case 'form-urlencoded': {
      return generateFormUrlEncodedRequest(requestValues)
    }
    case 'form': {
      return generateFormDataRequest(requestValues)
    }
    default: {
      return generateFormDataRequest(requestValues)
    }
  }
}

export function convertObjectToSnakeCase<T>(object: Record<string, T>): Record<string, T> {
  return Object.entries(object).reduce<Record<string, T>>((acc, [key, value]) => {
    acc[snakeCase(key)] = value
    return acc
  }, {})
}

function stringifyTokenRequestError(error: unknown): string {
  try {
    if (error !== null && typeof error === 'object' && 'data' in error) {
      const data: unknown = error.data
      if (
        data !== null &&
        typeof data === 'object' &&
        ('error' in data || 'error_description' in data)
      ) {
        const code = 'error' in data ? String(data.error) : 'undefined'
        const description =
          'error_description' in data ? String(data.error_description) : 'undefined'
        return `${code}: ${description}`
      }
    }

    if (error instanceof Error) {
      const message: unknown = error.message
      return String(message)
    }
    if (error !== null && typeof error === 'object') {
      const serialized: unknown = JSON.stringify(error)
      return typeof serialized === 'string' && serialized !== ''
        ? serialized
        : 'Unknown token request error'
    }
    return String(error)
  } catch {
    return 'Unknown token request error'
  }
}

function normalizeEncodedSequences(value: string): string {
  return value
    .replaceAll(/%[0-9a-f]{2}/giu, (triplet) => triplet.toUpperCase())
    .replaceAll(/\\u[0-9a-f]{4}/gu, (sequence) => `\\u${sequence.slice(2).toUpperCase()}`)
}

function redactSecretVariant(message: string, secret: string): string {
  const normalizedSecret = normalizeEncodedSequences(secret)
  let redacted = message
  let searchStart = 0

  let index = normalizeEncodedSequences(redacted).indexOf(normalizedSecret, searchStart)
  while (index !== -1) {
    redacted = `${redacted.slice(0, index)}[REDACTED]${redacted.slice(index + secret.length)}`
    searchStart = index + '[REDACTED]'.length
    index = normalizeEncodedSequences(redacted).indexOf(normalizedSecret, searchStart)
  }
  return redacted
}

export function formatTokenRequestError(error: unknown, clientSecret: string): string {
  const message = stringifyTokenRequestError(error)

  if (!clientSecret) {
    return message
  }

  const encodedSecrets = new Set([clientSecret])
  const encodeSecretVariants = [
    () => encodeURIComponent(clientSecret),
    () => JSON.stringify(clientSecret).slice(1, -1),
    () => new URLSearchParams({ value: clientSecret }).toString().slice('value='.length),
    () => new URLSearchParams({ value: clientSecret }).get('value') ?? clientSecret,
  ]
  for (const encodeSecret of encodeSecretVariants) {
    try {
      encodedSecrets.add(encodeSecret())
    } catch {
      continue
    }
  }

  return [...encodedSecrets]
    .toSorted((a, b) => b.length - a.length)
    .reduce((redacted, secret) => redactSecretVariant(redacted, secret), message)
}
