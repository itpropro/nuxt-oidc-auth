import type { OidcProviderConfig } from '../types/oidc'
import { defineOidcProvider } from './provider'

type OidcRequiredFields = 'clientId' | 'clientSecret' | 'authorizationUrl' | 'tokenUrl' | 'redirectUri'

export const oidc = defineOidcProvider<OidcProviderConfig, OidcRequiredFields>()
