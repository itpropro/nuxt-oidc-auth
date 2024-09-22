import type { OidcProviderConfig } from '../server/utils/provider'
import { defineOidcProvider } from '../server/utils/provider'

type AppleRequiredFields = 'clientId' | 'clientSecret' | 'authorizationUrl' | 'tokenUrl' | 'redirectUri'

export const apple = defineOidcProvider<OidcProviderConfig, AppleRequiredFields>({
  authorizationUrl: 'https://appleid.apple.com/auth/oauth2/v2/authorize',
  tokenUrl: 'https://appleid.apple.com/auth/oauth2/v2/token',
  userInfoUrl: '',
  tokenRequestType: 'json',
  responseType: 'code',
  authenticationScheme: 'body',
  grantType: 'authorization_code',
  scope: ['user:email'],
  pkce: false,
  state: true,
  nonce: false,
  scopeInTokenRequest: false,
  skipAccessTokenParsing: true,
  requiredProperties: [
    'clientId',
    'clientSecret',
    'authorizationUrl',
    'tokenUrl',
    'redirectUri',
  ],
  validateAccessToken: false,
  validateIdToken: false,
})
