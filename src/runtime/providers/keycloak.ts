import { ofetch } from 'ofetch'
import { defineOidcProvider } from './provider'
import { generateProviderUrl } from '../server/utils/config'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { OidcProviderConfig } from '../types/oidc'

type KeycloakRequiredFields = 'baseUrl' | 'clientId' | 'clientSecret' | 'redirectUri'

interface KeycloakProviderConfig {
  realm?: string
}

export const keycloak = defineOidcProvider<KeycloakProviderConfig, KeycloakRequiredFields>({
  authorizationUrl: 'protocol/openid-connect/auth',
  tokenUrl: 'protocol/openid-connect/token',
  userinfoUrl: 'protocol/openid-connect/userinfo',
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
