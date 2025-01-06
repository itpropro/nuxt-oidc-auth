import { createProviderFetch, defineOidcProvider } from '../server/utils/provider'

type MicrosoftRequiredFields = 'clientId' | 'clientSecret'

interface MicrosoftAdditionalFields {
  /**
   * Optional. Indicates the type of user interaction that is required. Valid values are `login`, `none`, `consent`, and `select_account`.
   * @default 'login'
   */
  prompt?: 'login' | 'none' | 'consent' | 'select_account'
  /**
   * Optional. You can use this parameter to pre-fill the username and email address field of the sign-in page for the user. Apps can use this parameter during reauthentication, after already extracting the login_hint optional claim from an earlier sign-in.
   * @default undefined
   */
  loginHint?: string
  /**
   * Optional. Enables sign-out to occur without prompting the user to select an account. To use logout_hint, enable the login_hint optional claim in your client application and use the value of the login_hint optional claim as the logout_hint parameter.
   * @default undefined
   */
  logoutHint?: string
  /**
   * Optional. If included, the app skips the email-based discovery process that user goes through on the sign-in page, leading to a slightly more streamlined user experience.
   * @default undefined
   */
  domainHint?: string
}

interface MicrosoftProviderConfig {
  /**
   * Required. The tenant id is used to automatically configure the correct endpoint urls for the Microsoft provider to work.
   * @default 'login'
   */
  tenantId: 'login' | 'none' | 'consent' | 'select_account'
}

export const microsoft = defineOidcProvider<MicrosoftAdditionalFields, MicrosoftRequiredFields, MicrosoftProviderConfig>({
  tokenRequestType: 'form-urlencoded',
  logoutRedirectParameterName: 'post_logout_redirect_uri',
  grantType: 'authorization_code',
  // scopeInTokenRequest: true,
  scope: ['openid', 'User.Read'],
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
  responseType: 'code id_token',
  async openIdConfiguration(config: any) {
    const customFetch = createProviderFetch(config)
    const openIdConfig = await customFetch(`https://login.microsoftonline.com/${config.tenantId ? config.tenantId : 'common'}/v2.0/.well-known/openid-configuration`)
    openIdConfig.issuer = config.tenantId ? [`https://login.microsoftonline.com/${config.tenantId}/v2.0`, openIdConfig.issuer] : undefined
    return openIdConfig
  },
  sessionConfiguration: {
    expirationCheck: true,
    automaticRefresh: true,
    expirationThreshold: 1800,
  },
  skipAccessTokenParsing: true,
  validateAccessToken: false,
  validateIdToken: true,
  additionalAuthParameters: {
    prompt: 'select_account',
  },
  optionalClaims: ['name', 'preferred_username'],
  baseUrl: 'https://login.microsoftonline.com/common',
  authorizationUrl: '/oauth2/v2.0/authorize',
  tokenUrl: '/oauth2/v2.0/token',
  userInfoUrl: 'https://graph.microsoft.com/v1.0/me', // https://graph.microsoft.com/oidc/userinfo"
})
