import type { OidcProviderConfig } from '../server/utils/provider'
import { defineOidcProvider } from '../server/utils/provider'

type PayPalRequiredFields = 'clientId' | 'clientSecret'

export const paypal = defineOidcProvider<OidcProviderConfig, PayPalRequiredFields>({
  responseType: 'code',
  validateAccessToken: false,
  validateIdToken: false,
  skipAccessTokenParsing: true,
  state: true,
  nonce: true,
  tokenRequestType: 'form-urlencoded',
  scope: ['openid'],
  requiredProperties: [
    'clientId',
    'clientSecret',
    'authorizationUrl',
    'tokenUrl',
    'redirectUri',
  ],
  authorizationUrl: '',
  tokenUrl: '',
  userInfoUrl: '',
  redirectUri: '',
})
