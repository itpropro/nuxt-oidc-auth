import { defineOidcProvider } from '../provider'

export const entra = defineOidcProvider({
  responseType: 'code',
  authenticationScheme: 'header',
  responseMode: '',
  userinfoUrl: '',
  logoutRedirectParameterName: 'post_logout_redirect_uri',
  grantType: 'authorization_code',
  scope: ['openid'],
  pkce: true,
  state: true,
  nonce: false,
  scopeInTokenRequest: true,
  userNameClaim: '',
  requiredProperties: [
    'clientId',
    'clientSecret',
    'authorizationUrl',
    'tokenUrl',
    'redirectUri',
  ],
})
