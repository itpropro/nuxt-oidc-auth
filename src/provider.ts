import type { OidcProviderConfig } from '#oidc-auth'

export function defineOidcProvider<TConfig>(config: OidcProviderConfig & TConfig) {
  return config
}
