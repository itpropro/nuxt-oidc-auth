/**
 * Type definitions for test infrastructure
 *
 * These types are used only within the test suite and do not modify runtime types.
 */

/**
 * Configuration for a provider under test
 */
export interface TestProviderConfig {
  /** Provider identifier (e.g., 'auth0', 'keycloak') */
  name: string

  /** Whether this provider's tests are enabled */
  enabled: boolean

  /** Required environment variables for this provider */
  requiredEnvVars: string[]

  /** Whether tests can run offline with mock */
  offlineCapable: boolean

  /** Provider-specific configuration overrides */
  config: Record<string, unknown>
}

/**
 * Configuration for the mock OIDC provider used in offline tests
 */
export interface MockOidcServerConfig {
  /** Issuer URL (typically http://localhost:xxxx) */
  issuer: string

  /** Access token lifetime in seconds */
  accessTokenTtl: number

  /** Refresh token lifetime in seconds */
  refreshTokenTtl: number

  /** Simulated network delay in ms (0 for instant) */
  latencyMs: number

  /** Force error responses for edge case testing */
  forceError?: {
    endpoint: 'authorize' | 'token' | 'userinfo' | 'jwks'
    statusCode: number
    errorCode: string
  }
}

/**
 * Mock session data for unit/functional tests
 */
export interface TestSession {
  /** Session ID */
  id: string

  /** Provider that issued this session */
  provider: string

  /** User identifier */
  userId: string

  /** Unix timestamp of session creation */
  createdAt: number

  /** Unix timestamp of last update */
  updatedAt: number

  /** Unix timestamp of expiration */
  expireAt: number

  /** Whether session has refresh capability */
  canRefresh: boolean

  /** Optional access token (for exposeAccessToken tests) */
  accessToken?: string

  /** Optional ID token (for exposeIdToken tests) */
  idToken?: string
}

/**
 * Token response from mock OIDC provider
 */
export interface MockTokenSet {
  /** JWT access token */
  accessToken: string

  /** Opaque refresh token */
  refreshToken: string

  /** JWT ID token (for OIDC flows) */
  idToken?: string

  /** Token type (always 'Bearer') */
  tokenType: 'Bearer'

  /** Expiration in seconds */
  expiresIn: number

  /** Granted scopes (space-separated) */
  scope: string
}

/**
 * Structured result for provider test validation
 */
export interface ProviderTestResult {
  /** Provider name */
  provider: string

  /** Whether test was executed */
  executed: boolean

  /** Skip reason if not executed */
  skipReason?: string

  /** Test outcomes */
  results: {
    signIn: 'pass' | 'fail' | 'skip'
    signOut: 'pass' | 'fail' | 'skip'
    refresh: 'pass' | 'fail' | 'skip' | 'n/a'
  }

  /** Timing information */
  durationMs: number
}

/**
 * Result of environment validation for provider tests
 */
export interface EnvValidationResult {
  /** Provider name */
  provider: string

  /** Whether all required vars are present */
  configured: boolean

  /** List of missing environment variables */
  missingVars: string[]

  /** List of present environment variables (names only, no values) */
  presentVars: string[]
}

/**
 * Options for creating mock tokens
 */
export interface CreateMockTokensOptions {
  /** User ID to embed in tokens */
  userId?: string

  /** Scopes to include in tokens */
  scopes?: string[]

  /** Token expiration in seconds */
  expiresIn?: number

  /** Whether to include an ID token */
  includeIdToken?: boolean

  /** Issuer URL */
  issuer?: string

  /** Audience */
  audience?: string
}

/**
 * Options for creating test sessions
 */
export interface CreateTestSessionOptions {
  /** Provider name */
  provider?: string

  /** User ID */
  userId?: string

  /** Whether session can refresh */
  canRefresh?: boolean

  /** Session expiration in seconds from now */
  expiresIn?: number

  /** Include access token */
  accessToken?: string

  /** Include ID token */
  idToken?: string
}
