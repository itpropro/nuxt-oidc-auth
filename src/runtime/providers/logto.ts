import { normalizeURL, withHttps, withoutTrailingSlash } from 'ufo'
import { createProviderFetch, defineOidcProvider } from '../server/utils/provider'

interface LogtoProviderConfig {
  /**
   * Specifies the first screen that the user will see.
   * @default undefined
   */
  firstScreen?: string
  /**
   * Specifies the identifier types that the sign-in or sign-up form will accept.
   * @default undefined
   */
  identifier?: string
  /**
   * Populates the identifier field with the user's email address or username. (This is a OIDC standard parameter)
   * @default undefined
   */
  loginHint?: string
  /**
   * Indicates the type of user interaction that is required. Valid values are login, none, consent, and select_account.
   * @default undefined
   */
  prompt?: 'login' | 'none' | 'consent' | 'select_account'
}

type LogtoRequiredFields = 'baseUrl' | 'clientId' | 'clientSecret'

export const logto = defineOidcProvider<LogtoProviderConfig, LogtoRequiredFields>({
  logoutRedirectParameterName: 'post_logout_redirect_uri',
  tokenRequestType: 'form-urlencoded',
  authenticationScheme: 'body',
  userInfoUrl: 'oidc/me',
  pkce: true,
  state: true,
  nonce: true,
  scopeInTokenRequest: false,
  userNameClaim: '',
  authorizationUrl: '/oidc/auth',
  tokenUrl: '/oidc/token',
  logoutUrl: '/oidc/session/end',
  scope: ['profile', 'openid', 'offline_access'],
  requiredProperties: [
    'baseUrl',
    'clientId',
    'clientSecret',
    'authorizationUrl',
    'tokenUrl',
  ],
  // For offline_access, we need to set prompt to 'consent'
  additionalAuthParameters: {
    prompt: 'consent',
  },
  additionalLogoutParameters: {
    idTokenHint: '',
  },
  async openIdConfiguration(config: any) {
    const baseUrl = normalizeURL(withoutTrailingSlash(withHttps(config.baseUrl as string)))
    const customFetch = createProviderFetch(config)
    return await customFetch(`${baseUrl}/oidc/.well-known/openid-configuration`)
  },
  skipAccessTokenParsing: true,
  validateAccessToken: false,
  validateIdToken: true,
  exposeIdToken: true,
})
