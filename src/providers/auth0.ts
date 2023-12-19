import { ofetch } from 'ofetch'
import { defineOidcProvider } from '../provider'
import { normalizeURL, withoutTrailingSlash, withHttps } from 'ufo'

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
    'baseUrl',
    'clientId',
    'clientSecret',
    'authorizationUrl',
    'tokenUrl',
    'redirectUri',
  ],
  async openIdConfiguration(config) {
    const baseUrl = normalizeURL(withoutTrailingSlash(withHttps(config.baseUrl as string)))
    return await ofetch(`${baseUrl}/.well-known/openid-configuration`)
  },
  validateAccessToken: true,
  validateIdToken: false,
})
