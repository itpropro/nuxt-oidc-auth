import type { TokenRespose, Tokens } from '../../types'
import type { OidcProviderConfig, createProviderFetch } from './provider'
import type { JwtPayload } from './security'
import { validateToken } from './security'

type ProviderFetch = Awaited<ReturnType<typeof createProviderFetch>>

interface ValidateTokenResponseOptions {
  accessToken: JwtPayload | Record<string, never>
  config: OidcProviderConfig
  customFetch: ProviderFetch
  expectedIdTokenClaims?: IdTokenContinuityClaims
  expectedNonce?: string
  idToken?: JwtPayload | Record<string, never>
  nonceRequired?: boolean
  tokenResponse: TokenRespose
}

export interface IdTokenContinuityClaims {
  audiences: string[]
  authenticationTime?: number
  authorizedParty?: string
  issuer: string
  subject: string
}

export interface TokenValidationResult {
  legacyValidationSkipped: boolean
  tokens: Tokens
}

function hasExactAudience(payload: JwtPayload | undefined, expectedAudiences: string[]): boolean {
  if (typeof payload?.aud === 'string') return expectedAudiences.includes(payload.aud)
  if (!Array.isArray(payload?.aud)) return false
  return payload.aud.some(
    (audience) => typeof audience === 'string' && expectedAudiences.includes(audience),
  )
}

function isIssuer(value: unknown): value is string | string[] {
  return (
    typeof value === 'string' ||
    (Array.isArray(value) && value.every((issuer) => typeof issuer === 'string'))
  )
}

function isStrictIssuer(value: unknown): value is string | string[] {
  return (
    (typeof value === 'string' && value.trim().length > 0) ||
    (Array.isArray(value) &&
      value.length > 0 &&
      value.every((issuer) => typeof issuer === 'string' && issuer.trim().length > 0))
  )
}

function normalizedAudience(value: unknown): string[] | undefined {
  const audiences = typeof value === 'string' ? [value] : value
  if (
    !Array.isArray(audiences) ||
    audiences.length === 0 ||
    !audiences.every((audience) => typeof audience === 'string' && audience.length > 0)
  ) {
    return undefined
  }
  return [...new Set(audiences)].sort((left, right) => left.localeCompare(right))
}

async function validateOidcIdToken(
  token: string,
  options: Parameters<typeof validateToken>[1],
  clientId: string,
  expectedIdTokenClaims?: IdTokenContinuityClaims,
  expectedNonce?: string,
  nonceRequired = false,
): Promise<JwtPayload> {
  const payload = await validateToken(token, {
    ...options,
    requiredClaims: [...new Set([...(options.requiredClaims || []), 'sub', 'iat'])],
  })
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('ID token sub must be a non-empty string')
  }
  if (expectedIdTokenClaims && payload.sub !== expectedIdTokenClaims.subject) {
    throw new Error('Refreshed ID token sub must match the original ID token')
  }
  const authorizedParty = payload.azp
  if (
    (Array.isArray(payload.aud) && payload.aud.length > 1 && typeof authorizedParty !== 'string') ||
    (authorizedParty !== undefined && authorizedParty !== clientId)
  ) {
    throw new Error('ID token azp must match clientId and is required for multiple audiences')
  }
  if (expectedIdTokenClaims) {
    if (payload.iss !== expectedIdTokenClaims.issuer) {
      throw new Error('Refreshed ID token iss must match the original ID token')
    }
    const audiences = normalizedAudience(payload.aud)
    if (
      !audiences ||
      audiences.length !== expectedIdTokenClaims.audiences.length ||
      audiences.some((audience, index) => audience !== expectedIdTokenClaims.audiences[index])
    ) {
      throw new Error('Refreshed ID token aud must match the original ID token')
    }
    if (authorizedParty !== expectedIdTokenClaims.authorizedParty) {
      throw new Error('Refreshed ID token azp must match the original ID token')
    }
    if (payload.auth_time !== expectedIdTokenClaims.authenticationTime) {
      throw new Error('Refreshed ID token auth_time must match the original ID token')
    }
  }
  if (nonceRequired && (typeof expectedNonce !== 'string' || expectedNonce.length === 0)) {
    throw new Error('Authentication session is missing the expected nonce')
  }
  if (nonceRequired && payload.nonce !== expectedNonce) {
    throw new Error('ID token nonce must match the authentication request')
  }
  return payload
}

export async function validateTokenResponse({
  accessToken,
  config,
  customFetch,
  expectedIdTokenClaims,
  expectedNonce,
  idToken,
  nonceRequired = false,
  tokenResponse,
}: ValidateTokenResponseOptions): Promise<TokenValidationResult> {
  const strictValidation = config.tokenValidationMode === 'strict'
  if (
    strictValidation &&
    (typeof tokenResponse.access_token !== 'string' || tokenResponse.access_token.length === 0)
  ) {
    throw new Error('Missing access token')
  }
  if (strictValidation && config.validateIdToken && !tokenResponse.id_token) {
    throw new Error('Missing ID token')
  }

  const legacyAudiences = [config.audience, config.clientId].filter(
    (audience): audience is string => !!audience,
  )
  const legacyAudienceMatched =
    !strictValidation &&
    (hasExactAudience(accessToken, legacyAudiences) || hasExactAudience(idToken, legacyAudiences))
  const validateAccessToken =
    !!config.validateAccessToken && (strictValidation || legacyAudienceMatched)
  const validateIdToken =
    !!config.validateIdToken &&
    !!tokenResponse.id_token &&
    (strictValidation || legacyAudienceMatched)

  let tokens: Tokens
  if (validateAccessToken || validateIdToken) {
    const openIdConfiguration =
      config.openIdConfiguration && typeof config.openIdConfiguration === 'object'
        ? config.openIdConfiguration
        : typeof config.openIdConfiguration === 'string'
          ? await customFetch<Record<string, unknown>>(config.openIdConfiguration)
          : await config.openIdConfiguration!(config)
    const issuer = openIdConfiguration.issuer
    const jwksUri = openIdConfiguration.jwks_uri
    if (strictValidation && (!isStrictIssuer(issuer) || typeof jwksUri !== 'string' || !jwksUri)) {
      throw new Error('Strict token validation requires discovery issuer and jwks_uri')
    }
    if (!strictValidation && issuer && !isIssuer(issuer)) {
      throw new Error('OpenID configuration has invalid issuer metadata')
    }
    if (typeof jwksUri !== 'string' || !jwksUri) {
      throw new Error('OpenID configuration is missing jwks_uri')
    }
    const validatedIssuer = strictValidation
      ? isStrictIssuer(issuer)
        ? issuer
        : undefined
      : isIssuer(issuer)
        ? issuer
        : undefined
    const commonValidationOptions = {
      jwksUri,
      ...(validatedIssuer !== undefined && { issuer: validatedIssuer }),
      ...(strictValidation && { requiredClaims: ['exp'] }),
    }
    const legacyAudience = config.audience ? { audience: [config.audience, config.clientId] } : {}
    tokens = {
      accessToken: validateAccessToken
        ? await validateToken(tokenResponse.access_token, {
            ...commonValidationOptions,
            ...(strictValidation ? { audience: config.audience } : legacyAudience),
          })
        : accessToken,
      ...(tokenResponse.refresh_token && { refreshToken: tokenResponse.refresh_token }),
      ...(tokenResponse.id_token && {
        idToken: validateIdToken
          ? strictValidation
            ? await validateOidcIdToken(
                tokenResponse.id_token,
                { ...commonValidationOptions, audience: config.clientId },
                config.clientId,
                expectedIdTokenClaims,
                expectedNonce,
                nonceRequired,
              )
            : await validateToken(tokenResponse.id_token, {
                ...commonValidationOptions,
                ...legacyAudience,
              })
          : idToken,
      }),
    }
  } else {
    tokens = {
      accessToken,
      ...(tokenResponse.refresh_token && { refreshToken: tokenResponse.refresh_token }),
      ...(idToken && { idToken }),
    }
  }

  return {
    legacyValidationSkipped:
      !strictValidation &&
      ((!!config.validateAccessToken && !validateAccessToken) ||
        (!!config.validateIdToken && !validateIdToken)),
    tokens,
  }
}
