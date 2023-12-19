import type { SearchParameters } from 'ofetch'

export interface OAuthOidcConfig {
  /**
   * OIDC Client ID
   */
  clientId: string
  /**
   * OIDC Client Secret
   */
  clientSecret: string
  /**
   * OIDC Response Type
   */
  responseType?: 'code' | 'code token' | 'code id_token' | 'id_token token' | 'code id_token token'
  /**
   * OIDC Authentication scheme
   */
  authenticationScheme?: 'header' | 'body'
  /**
   * OIDC Response Mode
   */
  responseMode?: 'query' | 'fragment' | 'form_post' | ''
  /**
   * OIDC Authorization Endpoint URL
   */
  authorizationUrl?: string
  /**
   * OIDC Token Endpoint URL
   */
  tokenUrl?: string
  /**
   * OIDC Userinfo Endpoint URL
   * @default ''
   */
  userinfoUrl?: string
  /**
   * OIDC Redirect URI
   */
  redirectUri: string
  /**
   * OIDC Grant Type
   * @default 'authorization_code'
   */
  grantType?: 'authorization_code' | 'refresh_token'
  /**
   * OIDC Scope
   * @default ['openid']
   */
  scope?: string[]
  /**
   * Use PKCE (Proof Key for Code Exchange)
   * @default true
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
   * OIDC Logout Endpoint URL
   * @default ''
   */
  logoutUrl?: string
  scopeInTokenRequest?: boolean
  tokenRequestType?: 'form' | 'json'
}

export interface AuthSession {
  state: string
  nonce: string
  codeVerifier: string
  redirect: string
}

export interface TokenRequest {
  client_id: string
  code: string
  redirect_uri: string
  grant_type: string
  scope?: string
  state?: string
  code_verifier?: string
  client_secret?: string
  audience?: string
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
  scope: string
  grant_type: 'refresh_token'
  refresh_token: string
  client_secret?: string
  redirect_uri?: string
}

export interface AuthorizationRequest extends SearchParameters {
  client_id: string
  response_type: string
  scope?: string
  redirect_uri?: string
  state?: string
  nonce?: string
  response_mode?: 'query' | 'fragment' | 'form_post'
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

export interface OidcProviderConfig extends Partial<OAuthOidcConfig> {
  requiredProperties: string[]
  logoutRedirectParameterName?: string
  additionalAuthParameters?: Record<string, string>
  additionalTokenParameters?: Record<string, string>
  baseUrl?: string
}
