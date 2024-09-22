import { ofetch } from 'ofetch'
import { generateProviderUrl } from '../server/utils/config'
import { defineOidcProvider } from '../server/utils/provider'

type KeycloakRequiredFields = 'baseUrl' | 'clientId' | 'clientSecret' | 'redirectUri'

interface KeycloakProviderConfig {
  realm?: string
}

export const keycloak = defineOidcProvider<KeycloakProviderConfig, KeycloakRequiredFields>({
  authorizationUrl: 'protocol/openid-connect/auth',
  tokenUrl: 'protocol/openid-connect/token',
  userInfoUrl: 'protocol/openid-connect/userinfo',
  tokenRequestType: 'form-urlencoded',
  responseType: 'code',
  authenticationScheme: 'header',
  grantType: 'authorization_code',
  pkce: true,
  state: false,
  nonce: true,
  scopeInTokenRequest: false,
  skipAccessTokenParsing: false,
  requiredProperties: [
    'clientId',
    'clientSecret',
    'authorizationUrl',
    'tokenUrl',
    'redirectUri',
  ],
  validateAccessToken: true,
  validateIdToken: false,
  baseUrl: '',
  async openIdConfiguration(config: any) {
    const configUrl = generateProviderUrl(config.baseUrl, '.well-known/openid-configuration')
    return await ofetch(configUrl)
  },
})
