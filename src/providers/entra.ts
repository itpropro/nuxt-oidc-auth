import { ofetch } from 'ofetch'
import { defineOidcProvider } from '../provider'
import { parseURL } from 'ufo'

export const entra = defineOidcProvider({
  tokenRequestType: 'form',
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
  scopeInTokenRequest: false,
  userNameClaim: '',
  requiredProperties: [
    'clientId',
    'clientSecret',
    'authorizationUrl',
    'tokenUrl',
    'redirectUri',
  ],
  async openIdConfiguration(config) {
    const tenantId = parseURL(config.authorizationUrl).pathname.split('/')[1]
    const openIdConfig = await ofetch(`https://login.microsoftonline.com/${tenantId}/.well-known/openid-configuration`)
    openIdConfig.issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`
    return openIdConfig
  },
  validateAccessToken: false,
  validateIdToken: true,
})
