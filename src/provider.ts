import type { OidcProviderConfig } from '#oidc-auth'

export function defineOidcProvider<TConfig>(config: OidcProviderConfig & { additionalProperties?: TConfig }) {
  return config
}
