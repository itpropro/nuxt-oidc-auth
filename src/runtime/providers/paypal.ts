import { defineOidcProvider } from '../server/utils/provider'

type PayPalRequiredFields = 'clientId' | 'clientSecret'

export const paypal = defineOidcProvider<Record<string, string>, PayPalRequiredFields>(
  {
    responseType: 'code',
    validateAccessToken: false,
    validateIdToken: false,
    skipAccessTokenParsing: true,
    // PayPal does not support PKCE; opt out of the base default so no code challenge is sent.
    pkce: false,
    state: true,
    nonce: true,
    tokenRequestType: 'form-urlencoded',
    scope: ['openid'],
    requiredProperties: ['clientId', 'clientSecret', 'authorizationUrl', 'tokenUrl', 'redirectUri'],
    authorizationUrl: '',
    tokenUrl: '',
    userInfoUrl: '',
    redirectUri: '',
  },
  {
    additionalParameters: {},
    provider: {},
  },
)
