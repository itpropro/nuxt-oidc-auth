export type { UserSession } from './session'
export type { OAuthConfig } from './oauth-config'
import type { SessionConfig } from 'h3'
import type * as _PROVIDERS from '../providers'

export * from './oidc'
export type Providers = keyof typeof _PROVIDERS
export type ProviderConfigs = typeof _PROVIDERS

export type RemoveOptionalProps<T> = {
  [K in keyof T]-?: T[K]
}

export interface AuthSessionConfig extends Omit<SessionConfig, 'password'> {
  automaticRefresh?: boolean
  expirationCheck?: boolean
  password?: string
}

export interface ModuleOptions {
  enabled: boolean
  defaultProvider: Providers
  providers: Partial<ProviderConfigs>
  session: AuthSessionConfig
}
