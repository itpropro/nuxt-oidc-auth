import type { ProviderSessionConfig } from '../../types'
import { createDefu } from 'defu'
import { ofetch } from 'ofetch'
import { getProxyAgentOfetch } from './proxyAgent'

type MakePropertiesRequired<T, K extends keyof T> = T & Required<Pick<T, K>>

type PossibleCombinations<T extends string, U extends string = T>
  = T extends any ? (T | `${T} ${PossibleCombinations<Exclude<U, T>>}`) : never

export interface OidcProviderConfig {
  /**
   * Client ID - Required by OIDC spec
   */
  clientId: string
  /**
   * Client Secret
   */
  clientSecret: string
  /**
   * Response Type - Required by OIDC spec
   * @default 'code'
   */
  responseType: 'code' | 'code token' | 'code id_token' | 'id_token token' | 'code id_token token'
  /**
   * Authentication scheme
   * @default 'header'
   */
  authenticationScheme: 'header' | 'body' | 'none'
  /**
   * Response mode for authentication request
   * @see https://openid.net/specs/oauth-v2-multiple-response-types-1_0.html
   */
  responseMode: 'query' | 'fragment' | 'form_post' | string
  /**
   * Authorization endpoint URL
   */
  authorizationUrl: string
  /**
   * Token endpoint URL
   */
  tokenUrl: string
  /**
   * Userinfo endpoint URL
   */
  userInfoUrl?: string
  /**
   * Redirect URI - Required by OIDC spec
   */
  redirectUri: string
  /**
   * Grant Type
   * @default 'authorization_code'
   */
  grantType: 'authorization_code' | 'refresh_token'
  /**
   * Scope - 'openid' required by OIDC spec, use 'offline_access' to request a refresh_token
   * @default ['openid']
   * @example ['openid', 'profile', 'email']
   */
  scope?: string[]
  /**
   * Some token refresh endpoints require to strip the offline_access scope when requesting/refreshing a access_token
   * @default false
   */
  excludeOfflineScopeFromTokenRequest?: boolean
  /**
   * Use PKCE (Proof Key for Code Exchange)
   * @default false
   */
  pkce?: boolean
  /**
   * Use state parameter with a random value. If state is not used, the nonce parameter is used to identify the flow.
   * @default true
   */
  state?: boolean
  /**
   * Use nonce parameter with a random value.
   * @default false
   */
  nonce?: boolean
  /**
   * User name claim that is used to get the user name from the access token as a fallback in case the userinfo endpoint is not provided or the userinfo request fails.
   * @default ''
   */
  userNameClaim?: string
  /**
   * Claims to be extracted from the id token
   * @default []
   */
  optionalClaims?: string[]
  /**
   * Logout endpoint URL
   * @default ''
   */
  logoutUrl?: string
  /**
   * Include scope in token request
   * @default false
   */
  scopeInTokenRequest?: boolean
  /**
   * Token request type
   * @default 'form'
   */
  tokenRequestType?: 'form' | 'json' | 'form-urlencoded'
  /**
   * Audience used for token validation (not included in requests by default, use additionalTokenParameters or additionalAuthParameters to add it)
   */
  audience?: string
  /**
   * Required properties of the configuration that will be validated at runtime
   */
  requiredProperties: (keyof OidcProviderConfig)[]
  /**
   * Filter userinfo response to only include these properties
   */
  filterUserInfo?: string[]
  /**
   * Skip access token parsing (for providers that don't follow the OIDC spec/don't issue JWT access tokens)
   */
  skipAccessTokenParsing?: boolean
  /**
   * Query parameter name for logout redirect. Will be appended to the logoutUrl as a query parameter with this value and the name of logoutRedirectParameterName.
   */
  logoutRedirectUri?: string
  /**
   * Query parameter name for logout redirect. Will be appended to the logoutUrl as a query parameter with this name and a value of logoutRedirectUri. The logoutRedirectUri can also be provided as a parameter with the `logout` composable function.
   */
  logoutRedirectParameterName?: string
  /**
   * Additional parameters to be added to the authorization request
   * @default undefined
   */
  additionalAuthParameters?: Record<string, string>
  /**
   * Additional parameters to be added to the token request
   * @default undefined
   */
  additionalTokenParameters?: Record<string, string>
  /**
   * Additional parameters to be added to the logout request
   * @default undefined
   */
  additionalLogoutParameters?: Record<string, string>
  /**
   * OpenID Configuration object or function promise that resolves to an OpenID Configuration object
   */
  openIdConfiguration?: string | Record<string, unknown> | ((config: any) => Promise<Record<string, unknown>>)
  /**
   * Validate access token
   * @default true
   */
  validateAccessToken?: boolean
  /**
   * Validate id token
   * @default true
   */
  validateIdToken?: boolean
  /**
   * Provider Only. Base URL for the provider, used when to dynamically create authorizationUrl, tokenUrl, userinfoUrl and logoutUrl if possible
   */
  baseUrl?: string
  /**
   * Space-delimited list of string values that specifies whether the authorization server prompts the user for reauthentication and consent
   */
  prompt?: Array<'none'> | Array<PossibleCombinations<'login' | 'consent' | 'select_account'>>
  /**
   * Encode redirect uri query parameter in authorization request. Only for compatibility with services that don't implement proper parsing of query parameters.
   * @default false
   */
  encodeRedirectUri?: boolean
  /**
   * Expose raw access token to the client within session object
   * @default false
   */
  exposeAccessToken?: boolean
  /**
   * Expose raw id token to the client within session object
   * @default false
   */
  exposeIdToken?: boolean
  /**
   * Set a custom redirect url to redirect to after a successful callback
   * @default '/'
   */
  callbackRedirectUrl?: string
  /**
   * List of allowed callback redirect urls
   * @default []
   */
  allowedCallbackRedirectUrls?: string[]
  /**
   * List of allowed client-side user-added query parameters for the auth request
   * @default []
   */
  allowedClientAuthParameters?: string[]
  /**
   * Session configuration overrides
   * @default undefined
   */
  sessionConfiguration?: ProviderSessionConfig
  /**
   * Proxy URL
   * @default undefined
   */
  proxy?: string
  /**
   * WARNING: Only enable this in development/testing environments!
   * Enabling this option in production is a serious security risk as it bypasses SSL/TLS certificate validation
   * when using a proxy, making your application vulnerable to man-in-the-middle attacks.
   *
   * Ignore certificate errors when using a proxy
   * @default false
   */
  ignoreProxyCertificateErrors?: boolean
}

// Cannot import from utils here, otherwise Nuxt will throw '[worker reload] [worker init] Cannot access 'configMerger' before initialization'
const configMerger = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key]) && Array.isArray(value)) {
    obj[key] = key === 'requiredProperties' ? Array.from(new Set(obj[key].concat(value))) : value as any
    return true
  }
})

export function defineOidcProvider<TConfig, TRequired extends keyof (OidcProviderConfig & TProviderConfig), TProviderConfig extends object = object>(config: Partial<Omit<OidcProviderConfig, 'requiredProperties'> & { requiredProperties?: (keyof (TProviderConfig & OidcProviderConfig))[] }> & Partial<TProviderConfig> & { additionalAuthParameters?: Partial<TConfig>; additionalTokenParameters?: Partial<TConfig>; additionalLogoutParameters?: Partial<TConfig> } = {} as object) {
  const defaults: Partial<Omit<OidcProviderConfig, 'requiredProperties'> & { requiredProperties?: (keyof (TProviderConfig & OidcProviderConfig))[] }> = {
    clientId: '',
    redirectUri: '',
    clientSecret: '',
    authorizationUrl: '',
    tokenUrl: '',
    responseType: 'code',
    authenticationScheme: 'header',
    grantType: 'authorization_code',
    pkce: false,
    state: true,
    nonce: false,
    scope: ['openid'],
    scopeInTokenRequest: false,
    tokenRequestType: 'form',
    requiredProperties: [
      'clientId',
      'redirectUri',
      'clientSecret',
      'authorizationUrl',
      'tokenUrl',
    ],
    validateAccessToken: true,
    validateIdToken: true,
    skipAccessTokenParsing: false,
    exposeAccessToken: false,
    exposeIdToken: false,
    callbackRedirectUrl: '/',
    allowedClientAuthParameters: undefined,
    logoutUrl: '',
    sessionConfiguration: {
      automaticRefresh: true,
      expirationThreshold: 0,
      expirationCheck: true,
      singleSignOut: false,
      singleSignOutIdField: 'sub',
    },
    additionalAuthParameters: undefined,
    additionalTokenParameters: undefined,
    additionalLogoutParameters: undefined,
    excludeOfflineScopeFromTokenRequest: false,
  }
  const mergedConfig = configMerger(config, defaults)
  return mergedConfig as MakePropertiesRequired<Partial<typeof mergedConfig>, TRequired & 'redirectUri'>
}

export async function createProviderFetch(config: OidcProviderConfig) {
  if (config.proxy) {
    return await getProxyAgentOfetch(config.proxy!, config.ignoreProxyCertificateErrors)
  }
  return ofetch
}
