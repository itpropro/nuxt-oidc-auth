import { ofetch } from 'ofetch'
import { defineOidcProvider } from './provider'
import { parseURL } from 'ufo'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { OidcProviderConfig } from '../types/oidc'

type EntraIdRequiredFields = 'clientId' | 'clientSecret' | 'authorizationUrl' | 'tokenUrl' | 'redirectUri'

interface EntraProviderConfig {
  resource?: string
  audience?: string
  prompt?: 'login' | 'none' | 'consent' | 'select_account'
}

export const entra = defineOidcProvider<EntraProviderConfig, EntraIdRequiredFields>({
  tokenRequestType: 'form',
  responseType: 'code',
  authenticationScheme: 'header',
  logoutRedirectParameterName: 'post_logout_redirect_uri',
  grantType: 'authorization_code',
  scope: ['openid'],
  pkce: true,
  state: true,
  nonce: false,
  scopeInTokenRequest: false,
  requiredProperties: [
    'clientId',
    'clientSecret',
    'authorizationUrl',
    'tokenUrl',
    'redirectUri',
  ],
  async openIdConfiguration(config: any) {
    const parsedUrl = parseURL(config.authorizationUrl)
    const tenantId = parsedUrl.pathname.split('/')[1]
    const openIdConfig = await ofetch(`https://${parsedUrl.host}/${tenantId}/.well-known/openid-configuration${config.audience && `?appid=${config.audience}`}`)
    openIdConfig.issuer = [`https://${parsedUrl.host}/${tenantId}/v2.0`, openIdConfig.issuer]
    return openIdConfig
  },
  validateAccessToken: false,
  validateIdToken: true,
})
