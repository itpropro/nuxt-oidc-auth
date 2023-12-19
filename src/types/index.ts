export type { UserSession } from './session'
export type { OAuthConfig } from './oauth-config'
import type { SessionConfig } from 'h3'
import type { OidcProviderConfig } from './oidc'
import type * as _PROVIDERS from '../providers'

export * from './oidc'
export type Providers = keyof typeof _PROVIDERS;

export type RemoveOptionalProps<T> = {
  [K in keyof T]-?: T[K];
};

export interface AuthSessionConfig extends SessionConfig {
  automaticRefresh?: boolean
  refreshTokenSecret?: string
}

export interface ModuleOptions {
  enabled: boolean
  providers: Record<Providers, OidcProviderConfig>,
  session: AuthSessionConfig
}
