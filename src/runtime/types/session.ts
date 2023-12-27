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
  automaticRefresh?: boolean
  expirationCheck?: boolean
  maxAge?: number
  cookie?: {
    sameSite?: true | false | 'lax' | 'strict' | 'none' | undefined
    secure?: boolean | undefined
  }
}
