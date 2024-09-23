import { ofetch } from 'ofetch'
import { normalizeURL, withHttps, withoutTrailingSlash } from 'ufo'
import { defineOidcProvider } from '../server/utils/provider'

interface CognitoProviderConfig {
  connection?: string
  organization?: string
  invitation?: string
  loginHint?: string
}

type CognitoRequiredFields = 'baseUrl' | 'clientId' | 'clientSecret' | 'logoutRedirectUri' | 'openIdConfiguration'

export const cognito = defineOidcProvider<CognitoProviderConfig, CognitoRequiredFields>({
  userNameClaim: 'username',
  responseType: 'code',
  tokenRequestType: 'form-urlencoded',
  authenticationScheme: 'header',
  userInfoUrl: 'oauth2/userInfo',
  grantType: 'authorization_code',
  scope: ['openid'],
  pkce: true,
  state: true,
  nonce: true,
  scopeInTokenRequest: false,
  callbackRedirectUrl: '/',
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
    'openIdConfiguration',
  ],
  validateAccessToken: true,
  validateIdToken: true,
  additionalLogoutParameters: {
    clientId: '{clientId}',
  },
  sessionConfiguration: {
    expirationCheck: true,
    automaticRefresh: true,
    expirationThreshold: 240,
  },
  logoutRedirectParameterName: 'logout_uri',
})
