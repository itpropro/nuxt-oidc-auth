/**
 * Mock OIDC Provider for Offline Testing
 *
 * Implements essential OIDC endpoints for testing without external dependencies.
 * This is used for generic OIDC provider tests that need to run offline.
 */

import type { MockOidcServerConfig } from './types'
import { createMockTokens } from './test-helpers'

/**
 * Default configuration for the mock OIDC server
 */
export const defaultMockConfig: MockOidcServerConfig = {
  issuer: 'http://localhost:3000/mock-oidc',
  accessTokenTtl: 3600,
  refreshTokenTtl: 86400,
  latencyMs: 0,
}

/**
 * In-memory store for authorization codes and sessions
 */
const authorizationCodes = new Map<string, {
  userId: string
  clientId: string
  redirectUri: string
  scope: string
  nonce?: string
  codeChallenge?: string
  codeChallengeMethod?: string
}>()

const refreshTokens = new Map<string, {
  userId: string
  clientId: string
  scope: string
}>()

/**
 * Generate a random string for codes/tokens
 */
function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Create the OIDC discovery document
 */
export function createDiscoveryDocument(config: MockOidcServerConfig = defaultMockConfig): Record<string, unknown> {
  return {
    issuer: config.issuer,
    authorization_endpoint: `${config.issuer}/authorize`,
    token_endpoint: `${config.issuer}/token`,
    userinfo_endpoint: `${config.issuer}/userinfo`,
    jwks_uri: `${config.issuer}/.well-known/jwks.json`,
    end_session_endpoint: `${config.issuer}/logout`,
    registration_endpoint: `${config.issuer}/register`,
    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
    response_types_supported: ['code', 'token', 'id_token', 'code token', 'code id_token', 'token id_token', 'code token id_token'],
    response_modes_supported: ['query', 'fragment', 'form_post'],
    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    claims_supported: ['sub', 'name', 'email', 'email_verified', 'picture', 'preferred_username'],
    code_challenge_methods_supported: ['plain', 'S256'],
  }
}

/**
 * Handle authorization request
 * Returns redirect URL with authorization code
 */
export function handleAuthorize(params: {
  clientId: string
  redirectUri: string
  scope: string
  state: string
  nonce?: string
  codeChallenge?: string
  codeChallengeMethod?: string
  responseType?: string
}): string {
  const code = randomString(32)

  // Store authorization code for token exchange
  authorizationCodes.set(code, {
    userId: 'mock-user-123',
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    scope: params.scope,
    nonce: params.nonce,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod,
  })

  // Build redirect URL with code
  const redirectUrl = new URL(params.redirectUri)
  redirectUrl.searchParams.set('code', code)
  redirectUrl.searchParams.set('state', params.state)

  return redirectUrl.toString()
}

/**
 * Handle token request
 * Exchanges authorization code for tokens
 */
export function handleToken(params: {
  grantType: string
  code?: string
  refreshToken?: string
  clientId: string
  clientSecret?: string
  redirectUri?: string
  codeVerifier?: string
}, config: MockOidcServerConfig = defaultMockConfig): {
  success: boolean
  data?: Record<string, unknown>
  error?: { error: string, error_description: string }
} {
  // Check for forced errors
  if (config.forceError?.endpoint === 'token') {
    return {
      success: false,
      error: {
        error: config.forceError.errorCode,
        error_description: 'Forced error for testing',
      },
    }
  }

  if (params.grantType === 'authorization_code') {
    if (!params.code) {
      return {
        success: false,
        error: { error: 'invalid_request', error_description: 'Missing authorization code' },
      }
    }

    const storedCode = authorizationCodes.get(params.code)
    if (!storedCode) {
      return {
        success: false,
        error: { error: 'invalid_grant', error_description: 'Invalid authorization code' },
      }
    }

    // Validate PKCE if code challenge was used
    if (storedCode.codeChallenge && storedCode.codeChallengeMethod === 'S256') {
      if (!params.codeVerifier) {
        return {
          success: false,
          error: { error: 'invalid_grant', error_description: 'Missing code_verifier' },
        }
      }
      // In real implementation, verify S256 challenge
      // For mock, we just check verifier exists
    }

    // Remove used code (one-time use)
    authorizationCodes.delete(params.code)

    // Generate tokens
    const tokens = createMockTokens({
      userId: storedCode.userId,
      scopes: storedCode.scope.split(' '),
      expiresIn: config.accessTokenTtl,
      includeIdToken: storedCode.scope.includes('openid'),
      issuer: config.issuer,
    })

    // Store refresh token for later use
    refreshTokens.set(tokens.refreshToken, {
      userId: storedCode.userId,
      clientId: storedCode.clientId,
      scope: storedCode.scope,
    })

    return {
      success: true,
      data: {
        access_token: tokens.accessToken,
        token_type: tokens.tokenType,
        expires_in: tokens.expiresIn,
        refresh_token: tokens.refreshToken,
        scope: tokens.scope,
        ...(tokens.idToken && { id_token: tokens.idToken }),
      },
    }
  }

  if (params.grantType === 'refresh_token') {
    if (!params.refreshToken) {
      return {
        success: false,
        error: { error: 'invalid_request', error_description: 'Missing refresh token' },
      }
    }

    const storedToken = refreshTokens.get(params.refreshToken)
    if (!storedToken) {
      return {
        success: false,
        error: { error: 'invalid_grant', error_description: 'Invalid refresh token' },
      }
    }

    // Generate new tokens
    const tokens = createMockTokens({
      userId: storedToken.userId,
      scopes: storedToken.scope.split(' '),
      expiresIn: config.accessTokenTtl,
      includeIdToken: storedToken.scope.includes('openid'),
      issuer: config.issuer,
    })

    // Update refresh token
    refreshTokens.delete(params.refreshToken)
    refreshTokens.set(tokens.refreshToken, storedToken)

    return {
      success: true,
      data: {
        access_token: tokens.accessToken,
        token_type: tokens.tokenType,
        expires_in: tokens.expiresIn,
        refresh_token: tokens.refreshToken,
        scope: tokens.scope,
        ...(tokens.idToken && { id_token: tokens.idToken }),
      },
    }
  }

  return {
    success: false,
    error: { error: 'unsupported_grant_type', error_description: 'Grant type not supported' },
  }
}

/**
 * Handle userinfo request
 * Returns user claims based on access token
 */
export function handleUserinfo(config: MockOidcServerConfig = defaultMockConfig): {
  success: boolean
  data?: Record<string, unknown>
  error?: { error: string, error_description: string }
} {
  // Check for forced errors
  if (config.forceError?.endpoint === 'userinfo') {
    return {
      success: false,
      error: {
        error: config.forceError.errorCode,
        error_description: 'Forced error for testing',
      },
    }
  }

  // Return mock user info
  return {
    success: true,
    data: {
      sub: 'mock-user-123',
      name: 'Test User',
      preferred_username: 'testuser',
      email: 'test@example.com',
      email_verified: true,
      picture: 'https://example.com/avatar.png',
    },
  }
}

/**
 * Get mock JWKS for token validation
 */
export function getJwks(): Record<string, unknown> {
  // Simplified mock JWKS - in real tests, use jose library for proper keys
  return {
    keys: [
      {
        kty: 'RSA',
        use: 'sig',
        kid: 'mock-key-1',
        alg: 'RS256',
        n: 'mock-modulus-base64',
        e: 'AQAB',
      },
    ],
  }
}

/**
 * Clear all stored authorization codes and tokens
 * Call this between tests to ensure isolation
 */
export function clearMockState(): void {
  authorizationCodes.clear()
  refreshTokens.clear()
}

/**
 * Create h3 event handlers for registering with Nuxt test server
 */
export function createMockOidcHandlers(config: MockOidcServerConfig = defaultMockConfig) {
  return {
    // Discovery document
    '/.well-known/openid-configuration': () => createDiscoveryDocument(config),

    // JWKS endpoint
    '/.well-known/jwks.json': () => getJwks(),

    // These would be registered as event handlers in the test app
    // The actual implementation depends on h3/nitro integration
  }
}
