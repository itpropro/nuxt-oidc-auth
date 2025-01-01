import type { H3Event } from 'h3'

import type { SearchParameters } from 'ofetch'
import type * as _PROVIDERS from './providers'

import type { EncryptedToken, JwtPayload } from './server/utils/security'

export type ProviderKeys = 'apple' | 'auth0' | 'entra' | 'github' | 'keycloak' | 'oidc' | 'cognito' | 'zitadel' | 'paypal' | 'microsoft'
export type ProviderKeysWithDev = ProviderKeys | 'dev'

export interface ProviderConfigs {
  auth0: typeof _PROVIDERS.auth0
  apple: typeof _PROVIDERS.apple
  cognito: typeof _PROVIDERS.cognito
  entra: typeof _PROVIDERS.entra
  github: typeof _PROVIDERS.github
  keycloak: typeof _PROVIDERS.keycloak
  microsoft: typeof _PROVIDERS.microsoft
  oidc: typeof _PROVIDERS.oidc
  paypal: typeof _PROVIDERS.paypal
  zitadel: typeof _PROVIDERS.zitadel
}

export interface OAuthConfig<UserSession> {
  onSuccess: (
    event: H3Event,
    result: { user: UserSession | null; callbackRedirectUrl?: string }
  ) => Promise<void> | void
}

export interface MiddlewareConfig {
  /**
   * Enables/disables the global middleware
   * @default true
   */
  globalMiddlewareEnabled?: boolean
  /**
   * Enables/disables automatic registration of '/auth/login' and '/auth/logout' route rules
   * @default false
   */
  customLoginPage?: boolean
}

export interface DevModeConfig {
  /**
   * Enables/disables the dev mode. Dev mode can only be enabled when the app runs in a non production environment.
   * @default false
   */
  enabled?: boolean
  /**
   * Sets the `userName` field on the user object
   * @default 'Nuxt OIDC Auth Dev'
   */
  userName?: string
  /**
   * Sets the `userInfo` field on the user object
   */
  userInfo?: Record<string, unknown>
  /**
   * Sets the key algorithm for signing the generated JWT token
   */
  tokenAlgorithm?: 'symmetric' | 'asymmetric'
  /**
   * Sets the `idToken` field on the user object
   */
  idToken?: string
  /**
   * Sets the `accessToken` field on the user object
   */
  accessToken?: string
  /**
   * Sets the claims field on the user object and generated JWT token if `generateAccessToken` is set to `true`.
   */
  claims?: Record<string, string>
  /**
   * If set generates a JWT token for the access_token field based on the given user information
   * @default false
   */
  generateAccessToken?: boolean
  /**
   * Only used with `generateAccessToken`. Sets the issuer field on the generated JWT token.
   * @default 'nuxt:oidc:auth:issuer
   */
  issuer?: string
  /**
   * Only used with `generateAccessToken`. Sets the audience field on the generated JWT token.
   * @default 'nuxt:oidc:auth:audience
   */
  audience?: string
  /**
   * Only used with `generateAccessToken`. Sets the subject field on the generated JWT token.
   * @default 'nuxt:oidc:auth:subject
   */
  subject?: string
}

export interface AuthSession {
  state: string
  nonce: string
  codeVerifier: string
  redirect: string
}

export interface PersistentSession {
  exp: number
  iat: number
  accessToken: EncryptedToken
  refreshToken?: EncryptedToken
  idToken?: EncryptedToken
}

export interface TokenRequest {
  client_id: string
  code: string
  grant_type: string
  redirect_uri?: string
  scope?: string
  state?: string
  code_verifier?: string
  client_secret?: string
}

export interface TokenRespose {
  access_token: string
  token_type: string
  expires_in: string
  refresh_token?: string
  id_token?: string
}

export interface RefreshTokenRequest {
  client_id: string
  grant_type: 'refresh_token'
  refresh_token: string
  scope?: string
  client_secret?: string
  redirect_uri?: string
}

export interface AuthorizationRequest extends SearchParameters {
  client_id: string
  response_type: 'code' | 'code token' | 'code id_token' | 'id_token token' | 'code id_token token'
  scope?: string
  prompt?: string
  response_mode?: 'query' | 'fragment' | 'form_post' | string
  redirect_uri?: string
  state?: string
  nonce?: string
}

export interface PkceAuthorizationRequest extends AuthorizationRequest {
  code_challenge: string
  code_challenge_method: string
}

export interface AuthorizationResponse {
  code: string
  state?: string
  id_token?: string
}

export interface UserSession {
  provider: ProviderKeysWithDev
  canRefresh: boolean
  loggedInAt?: number
  expireAt: number
  updatedAt?: number
  userInfo?: Record<string, unknown>
  userName?: string
  claims?: Record<string, unknown>
  accessToken?: string
  idToken?: string
}

export interface Tokens {
  accessToken: JwtPayload
  idToken?: JwtPayload
  refreshToken?: string
}

export interface AuthSessionConfig {
  /**
   * Automatically refresh access token and session if refresh token is available (indicated by 'canRefresh' property on user object)
   * @default false
   */
  automaticRefresh?: boolean
  /**
   * Check if session is expired based on access token exp
   * @default true
   */
  expirationCheck?: boolean
  /**
   * Amount of seconds before access token expiration to trigger automatic refresh
   * @default 0
   */
  expirationThreshold?: number
  /**
   * Maximum user session duration in seconds. Will be refreshed if session is refreshed
   * @default 60 * 60 * 24 (86,400 = 1 day)
   */
  maxAge?: number
  /**
   * Maximum auth session duration in seconds. Will be refreshed if session is refreshed
   * @default 300 (5 minutes) default for registration and other flows that may take a while
   */
  maxAuthSessionAge?: number
  /**
   * Additional cookie setting overrides
   */
  cookie?: {
    /**
     * Cookie sameSite attribute - In most cases laving at default 'lax' is fine.
     * @default 'lax'
     */
    sameSite?: true | false | 'lax' | 'strict' | 'none' | undefined
    /**
     * Cookie secure attribute - Consider setting to true for production, enforces https only cookies
     * @default process.env.NODE_ENV === 'production'
     */
    secure?: boolean | undefined
  }
}

export interface ProviderSessionConfig extends Omit<AuthSessionConfig, 'maxAge' | 'cookie'> {}
