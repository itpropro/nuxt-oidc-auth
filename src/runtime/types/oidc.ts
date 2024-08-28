import type { SearchParameters } from 'ofetch'
import type { EncryptedToken } from '../server/utils/security'
import type * as _PROVIDERS from '../providers'

export type ProviderKeys = keyof typeof _PROVIDERS
export type ProviderConfigs = typeof _PROVIDERS

type PossibleCombinations<T extends string, U extends string = T> =
  T extends any ? (T | `${T} ${PossibleCombinations<Exclude<U, T>>}`) : never

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
  authenticationScheme: 'header' | 'body'
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
  userinfoUrl?: string
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
   * Scope - 'openid' required by OIDC spec
   * @default ['openid']
   * @example ['openid', 'profile', 'email']
   */
  scope?: string[]
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
  filterUserinfo?: string[]
  /**
   * Skip access token parsing (for providers that don't follow the OIDC spec/don't issue JWT access tokens)
   */
  skipAccessTokenParsing?: boolean
  /**
   * Query parameter name for logout redirect. Will be appended to the logoutUrl as a query parameter.
   */
  logoutRedirectParameterName?: string
  /**
   * Additional parameters to be added to the authorization request
   */
  additionalAuthParameters?: Record<string, string>
  /**
   * Additional parameters to be added to the token request
   */
  additionalTokenParameters?: Record<string, string>
  /**
   * OpenID Configuration object or function promise that resolves to an OpenID Configuration object
   */
  openIdConfiguration?: Record<string, unknown> | ((config: any) => Promise<Record<string, unknown>>)
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
   * Base URL for the provider, used when to dynamically create authorizationUrl, tokenUrl, userinfoUrl and logoutUrl if possible
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
}

export interface AuthSession {
  state: string
  nonce: string
  codeVerifier: string
  redirect: string
}

export interface PersistentSession {
  exp: number
  iat: number
  accessToken: EncryptedToken
  refreshToken: EncryptedToken
}

export interface TokenRequest {
  client_id: string
  code: string
  grant_type: string
  redirect_uri?: string
  scope?: string
  state?: string
  code_verifier?: string
  client_secret?: string
}

export interface TokenRespose {
  access_token: string
  token_type: string
  expires_in: string
  refresh_token?: string
  id_token?: string
}

export interface RefreshTokenRequest {
  client_id: string
  grant_type: 'refresh_token'
  refresh_token: string
  scope?: string
  client_secret?: string
  redirect_uri?: string
}

export interface AuthorizationRequest extends SearchParameters {
  client_id: string
  response_type: 'code' | 'code token' | 'code id_token' | 'id_token token' | 'code id_token token'
  scope?: string
  prompt?: string
  response_mode?: 'query' | 'fragment' | 'form_post' | string
  redirect_uri?: string
  state?: string
  nonce?: string
}

export interface PkceAuthorizationRequest extends AuthorizationRequest {
  code_challenge: string
  code_challenge_method: string
}

export interface AuthorizationResponse {
  code: string
  state?: string
  id_token?: string
}
