import { defineOidcProvider } from '../provider'

interface Auth0ProviderConfig {
  connection?: string
  organization?: string
  invitation?: string
  loginHint?: string
  audience?: string
}

export const auth0 = defineOidcProvider<Auth0ProviderConfig>({
  responseType: 'code',
  tokenRequestType: 'json',
  authenticationScheme: 'body', // Set to 'body' for 'Client Secret (Post)', set to 'header' for 'Client Secret (Basic)', set to '' for 'None'
  responseMode: '',
  userinfoUrl: 'userinfo',
  grantType: 'authorization_code',
  scope: ['openid'],
  pkce: true,
  state: true,
  nonce: false,
  scopeInTokenRequest: false,
  userNameClaim: '',
  authorizationUrl: 'authorize',
  tokenUrl: 'oauth/token',
  logoutUrl: '',
  requiredProperties: [
    'clientId',
    'clientSecret',
    'authorizationUrl',
    'tokenUrl',
    'redirectUri',
  ],
})
