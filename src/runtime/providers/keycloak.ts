import { ofetch } from 'ofetch'
import { generateProviderUrl } from '../server/utils/config'
import { defineOidcProvider } from '../server/utils/provider'

type KeycloakRequiredFields = 'baseUrl' | 'clientId' | 'clientSecret' | 'redirectUri'

interface KeycloakProviderConfig {
  /**
   * This parameter allows to slightly customize the login flow on the Keycloak server side. For example, enforce displaying the login screen in case of value login.
   * @default undefined
   */
  prompt?: string
  /**
   * Used to pre-fill the username/email field on the login form.
   * @default undefined
   */
  loginHint?: string
  /**
   * Used to tell Keycloak to skip showing the login page and automatically redirect to the specified identity provider instead.
   * @default undefined
   */
  idpHint?: string
  /**
   * Sets the 'ui_locales' query param.
   * @default undefined
   */
  locale?: string
}

export const keycloak = defineOidcProvider<KeycloakProviderConfig, KeycloakRequiredFields>({
  authorizationUrl: 'protocol/openid-connect/auth',
  tokenUrl: 'protocol/openid-connect/token',
  userInfoUrl: 'protocol/openid-connect/userinfo',
  tokenRequestType: 'form-urlencoded',
  userNameClaim: 'preferred_username',
  pkce: true,
  state: false,
  nonce: true,
  requiredProperties: [
    'clientId',
    'clientSecret',
    'authorizationUrl',
    'tokenUrl',
    'redirectUri',
  ],
  additionalLogoutParameters: {
    idTokenHint: '',
  },
  sessionConfiguration: {
    expirationCheck: true,
    automaticRefresh: true,
    expirationThreshold: 240,
  },
  validateAccessToken: true,
  validateIdToken: false,
  exposeIdToken: true,
  baseUrl: '',
  logoutUrl: 'protocol/openid-connect/logout',
  logoutRedirectParameterName: 'post_logout_redirect_uri',
  async openIdConfiguration(config: any) {
    const configUrl = generateProviderUrl(config.baseUrl, '.well-known/openid-configuration')
    return await ofetch(configUrl)
  },
})
