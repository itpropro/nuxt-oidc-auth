/**
 * Test Helper Functions
 *
 * Factory functions and utilities for creating test data
 */

import type { CreateMockTokensOptions, CreateTestSessionOptions, MockTokenSet, TestSession } from './types'
import { Buffer } from 'node:buffer'

/**
 * Generate a random string of specified length
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
 * Generate a random session ID
 */
function generateSessionId(): string {
  return `sess_${randomString(32)}`
}

/**
 * Generate a random user ID
 */
function generateUserId(): string {
  return `user_${randomString(16)}`
}

/**
 * Create a mock JWT token (simplified - not cryptographically signed)
 * For actual JWT validation tests, use jose library
 */
function createMockJwt(payload: Record<string, unknown>): string {
  const header = { alg: 'RS256', typ: 'JWT' }
  const headerBase64 = Buffer.from(JSON.stringify(header)).toString('base64url')
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = randomString(43) // Mock signature

  return `${headerBase64}.${payloadBase64}.${signature}`
}

/**
 * Create a test session with configurable properties
 *
 * @example
 * ```typescript
 * const session = createTestSession()
 * const customSession = createTestSession({
 *   provider: 'auth0',
 *   canRefresh: true,
 *   expiresIn: 7200
 * })
 * ```
 */
export function createTestSession(options: CreateTestSessionOptions = {}): TestSession {
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = options.expiresIn ?? 3600

  return {
    id: generateSessionId(),
    provider: options.provider ?? 'oidc',
    userId: options.userId ?? generateUserId(),
    createdAt: now,
    updatedAt: now,
    expireAt: now + expiresIn,
    canRefresh: options.canRefresh ?? true,
    accessToken: options.accessToken,
    idToken: options.idToken,
  }
}

/**
 * Create mock tokens for testing token operations
 *
 * @example
 * ```typescript
 * const tokens = createMockTokens()
 * const customTokens = createMockTokens({
 *   userId: 'user123',
 *   scopes: ['openid', 'profile', 'email'],
 *   includeIdToken: true
 * })
 * ```
 */
export function createMockTokens(options: CreateMockTokensOptions = {}): MockTokenSet {
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = options.expiresIn ?? 3600
  const userId = options.userId ?? generateUserId()
  const scopes = options.scopes ?? ['openid', 'profile']
  const issuer = options.issuer ?? 'http://localhost:3000'
  const audience = options.audience ?? 'test-client'

  const accessTokenPayload = {
    iss: issuer,
    sub: userId,
    aud: audience,
    exp: now + expiresIn,
    iat: now,
    scope: scopes.join(' '),
  }

  const result: MockTokenSet = {
    accessToken: createMockJwt(accessTokenPayload),
    refreshToken: `refresh_${randomString(40)}`,
    tokenType: 'Bearer',
    expiresIn,
    scope: scopes.join(' '),
  }

  if (options.includeIdToken) {
    const idTokenPayload = {
      iss: issuer,
      sub: userId,
      aud: audience,
      exp: now + expiresIn,
      iat: now,
      nonce: randomString(16),
      name: 'Test User',
      email: 'test@example.com',
    }
    result.idToken = createMockJwt(idTokenPayload)
  }

  return result
}

/**
 * Create an expired session for testing expiration handling
 */
export function createExpiredSession(options: CreateTestSessionOptions = {}): TestSession {
  const session = createTestSession(options)
  const now = Math.floor(Date.now() / 1000)

  // Set expiration to 1 hour ago
  session.expireAt = now - 3600
  session.updatedAt = now - 7200
  session.createdAt = now - 10800

  return session
}

/**
 * Create a session that's about to expire (for testing refresh timing)
 */
export function createExpiringSession(secondsUntilExpiry: number = 60): TestSession {
  const session = createTestSession()
  const now = Math.floor(Date.now() / 1000)

  session.expireAt = now + secondsUntilExpiry

  return session
}

/**
 * Wait for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create test environment variables for a provider
 * Useful for mocking process.env in tests
 */
export function createProviderEnvVars(provider: string, values: Record<string, string> = {}): Record<string, string> {
  const prefix = `NUXT_OIDC_PROVIDERS_${provider.toUpperCase()}_`

  const defaults: Record<string, Record<string, string>> = {
    auth0: {
      CLIENT_ID: 'test-client-id',
      CLIENT_SECRET: 'test-client-secret',
      BASE_URL: 'https://test.auth0.com',
    },
    keycloak: {
      CLIENT_ID: 'test-client-id',
      CLIENT_SECRET: 'test-client-secret',
      BASE_URL: 'http://localhost:8080/realms/test',
    },
    github: {
      CLIENT_ID: 'test-client-id',
      CLIENT_SECRET: 'test-client-secret',
    },
  }

  const providerDefaults = defaults[provider] ?? {}
  const merged = { ...providerDefaults, ...values }

  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(merged)) {
    result[`${prefix}${key}`] = value
  }

  return result
}
