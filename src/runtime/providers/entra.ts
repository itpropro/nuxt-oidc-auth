import { ofetch } from 'ofetch'
import { parseURL } from 'ufo'
import { createProviderFetch, defineOidcProvider } from '../server/utils/provider'

type EntraIdRequiredFields = 'clientId' | 'clientSecret' | 'authorizationUrl' | 'tokenUrl' | 'redirectUri'

interface EntraProviderConfig {
  /**
   * The resource identifier for the requested resource.
   * @default undefined
   */
  resource?: string
  /**
   * The audience for the token, typically the client ID.
   * @default undefined
   */
  audience?: string
  /**
   * Indicates the type of user interaction that is required. Valid values are login, none, consent, and select_account.
   * @default undefined
   */
  prompt?: 'login' | 'none' | 'consent' | 'select_account'
  /**
   * You can use this parameter to pre-fill the username and email address field of the sign-in page for the user. Apps can use this parameter during reauthentication, after already extracting the login_hint optional claim from an earlier sign-in.
   * @default undefined
   */
  loginHint?: string
  /**
   * Enables sign-out to occur without prompting the user to select an account. To use logout_hint, enable the login_hint optional claim in your client application and use the value of the login_hint optional claim as the logout_hint parameter.
   * @default undefined
   */
  logoutHint?: string
  /**
   * If included, the app skips the email-based discovery process that user goes through on the sign-in page, leading to a slightly more streamlined user experience.
   * @default undefined
   */
  domainHint?: string
}

export const entra = defineOidcProvider<EntraProviderConfig, EntraIdRequiredFields>({
  tokenRequestType: 'form-urlencoded',
  logoutRedirectParameterName: 'post_logout_redirect_uri',
  grantType: 'authorization_code',
  scope: ['openid'],
  pkce: true,
  state: true,
  nonce: true,
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
    const customFetch = createProviderFetch(config)
    const openIdConfig = await customFetch(`https://${parsedUrl.host}/${tenantId}/.well-known/openid-configuration${config.audience && `?appid=${config.audience}`}`)
    openIdConfig.issuer = [`https://${parsedUrl.host}/${tenantId}/v2.0`, openIdConfig.issuer]
    return openIdConfig
  },
  sessionConfiguration: {
    expirationCheck: true,
    automaticRefresh: true,
    expirationThreshold: 1800,
  },
  validateAccessToken: false,
  validateIdToken: true,
})
