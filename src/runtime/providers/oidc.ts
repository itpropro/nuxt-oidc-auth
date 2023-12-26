import { defineOidcProvider } from './provider'
import type { OidcProviderConfig } from '../types/oidc'

type OidcRequiredFields = 'clientId' | 'clientSecret' | 'authorizationUrl' | 'tokenUrl' | 'redirectUri'

export const oidc = defineOidcProvider<OidcProviderConfig, OidcRequiredFields>()
