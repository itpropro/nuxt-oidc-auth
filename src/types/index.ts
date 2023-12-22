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

export interface AuthSessionConfig extends SessionConfig {
  automaticRefresh?: boolean
  expirationCheck?: boolean
}

export interface ModuleOptions {
  enabled: boolean
  defaultProvider: Providers
  providers: ProviderConfigs
  session: AuthSessionConfig
}
