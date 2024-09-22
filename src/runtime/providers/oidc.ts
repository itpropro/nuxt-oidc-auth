import type { OidcProviderConfig } from '../server/utils/provider'
import { defineOidcProvider } from '../server/utils/provider'

type OidcRequiredFields = 'clientId' | 'clientSecret' | 'authorizationUrl' | 'tokenUrl' | 'redirectUri'

export const oidc = defineOidcProvider<OidcProviderConfig, OidcRequiredFields>()
