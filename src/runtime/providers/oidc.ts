import { defineOidcProvider } from '../server/utils/provider'

type OidcRequiredFields =
  | 'clientId'
  | 'clientSecret'
  | 'authorizationUrl'
  | 'tokenUrl'
  | 'redirectUri'

export const oidc = defineOidcProvider<Record<string, string>, OidcRequiredFields>(
  {},
  { additionalParameters: {}, provider: {} },
)
