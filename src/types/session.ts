export interface UserSession {
  provider?: string
  canRefresh?: boolean
  loggedInAt?: number
  updatedAt?: number
  providerInfo?: any
  userName?: string
  claims?: string[]
}

export interface Tokens {
  access_token: string
  id_token?: string
  refresh_token?: string
}
