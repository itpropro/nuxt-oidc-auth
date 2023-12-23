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

interface MiddlewareConfig {
  globalMiddlewareEnabled?: boolean
  customLoginPage?: boolean
}

export interface ModuleOptions {
  /**
   * Enable module
   */
  enabled: boolean
  /**
   * Default provider. Will be used with composable if no provider is specified
   */
  defaultProvider?: Providers
  /**
   * OIDC providers
   */
  providers: Partial<ProviderConfigs>
  /**
   * Optional session configuration.
   */
  session: AuthSessionConfig
  /**
   * Middleware configuration
   */
  middleware: MiddlewareConfig
}
