import { defineOidcProvider, type OidcProviderConfig } from '../server/utils/provider'

type CognitoRequiredFields = 'baseUrl' | 'clientId' | 'clientSecret' | 'logoutRedirectUri'

export const cognito = defineOidcProvider<OidcProviderConfig, CognitoRequiredFields>({
  userNameClaim: 'username',
  tokenRequestType: 'form-urlencoded',
  authenticationScheme: 'header',
  userInfoUrl: 'oauth2/userInfo',
  grantType: 'authorization_code',
  scope: ['openid'],
  pkce: true,
  state: true,
  nonce: true,
  authorizationUrl: 'oauth2/authorize',
  tokenUrl: 'oauth2/token',
  logoutUrl: 'logout',
  requiredProperties: [
    'baseUrl',
    'clientId',
    'clientSecret',
    'authorizationUrl',
    'tokenUrl',
    'logoutRedirectUri',
  ],
  validateAccessToken: false,
  validateIdToken: false,
  additionalLogoutParameters: {
    clientId: '{clientId}',
  },
  sessionConfiguration: {
    expirationCheck: true,
    automaticRefresh: true,
    expirationThreshold: 240,
  },
  exposeIdToken: true,
  logoutRedirectParameterName: 'logout_uri',
})
