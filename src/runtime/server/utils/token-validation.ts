import type { TokenRespose, Tokens } from '../../types'
import type { OidcProviderConfig, createProviderFetch } from './provider'
import type { JwtPayload } from './security'
import { validateToken } from './security'

type ProviderFetch = Awaited<ReturnType<typeof createProviderFetch>>

interface ValidateTokenResponseOptions {
  accessToken: JwtPayload | Record<string, never>
  config: OidcProviderConfig
  customFetch: ProviderFetch
  expectedNonce?: string
  idToken?: JwtPayload | Record<string, never>
  nonceRequired?: boolean
  tokenResponse: TokenRespose
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

async function validateOidcIdToken(
  token: string,
  options: Parameters<typeof validateToken>[1],
  clientId: string,
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
  const authorizedParty = payload.azp
  if (
    (Array.isArray(payload.aud) && payload.aud.length > 1 && typeof authorizedParty !== 'string') ||
    (authorizedParty !== undefined && authorizedParty !== clientId)
  ) {
    throw new Error('ID token azp must match clientId and is required for multiple audiences')
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
