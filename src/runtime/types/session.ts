import type { JwtPayload } from '../server/utils/security'
import type { ProviderKeys } from './oidc'

export interface ProviderInfo extends Record<string, unknown> {}

export interface UserSession {
  provider?: ProviderKeys | 'dev'
  canRefresh: boolean
  loggedInAt?: number
  expireAt: number
  updatedAt?: number
  providerInfo?: ProviderInfo
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
   * Maximum auth session duration in seconds. Will be refreshed if session is refreshed
   * @default 60 * 60 * 24 (86,400 = 1 day)
   */
  maxAge?: number
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
