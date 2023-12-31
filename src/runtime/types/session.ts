import type { JwtPayload } from '../server/utils/security'
import type { ProviderKeys } from './oidc'

export interface UserSession {
  provider?: ProviderKeys
  canRefresh?: boolean
  loggedInAt?: number
  updatedAt?: number
  providerInfo?: any
  userName?: string
  claims?: Record<string, unknown>
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
   * Maximum auth session duration in seconds
   * @default 60 * 60 * 24 (3600 = 1 day)
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
     * Cookie secure attribute - Consider setting to true for production, but would require HTTPS in development.
     * @default false
     */
    secure?: boolean | undefined
  }
}
