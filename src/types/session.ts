import type { JwtPayload } from '../runtime/server/utils/security'

export interface UserSession {
  provider?: string
  canRefresh?: boolean
  loggedInAt?: number
  updatedAt?: number
  providerInfo?: any
  userName?: string
  claims?: Record<string, unknown>
}

export interface Tokens {
  access_token: JwtPayload
  id_token?: JwtPayload
  refresh_token?: string
}
