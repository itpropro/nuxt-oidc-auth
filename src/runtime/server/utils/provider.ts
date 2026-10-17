import type { Defu } from 'defu'
import { createDefu } from 'defu'
import { FetchError, ofetch } from 'ofetch'
import type { $Fetch } from 'ofetch'

import type { ProviderSessionConfig } from '../../types'
import { getProxyAgentOfetch } from './proxyAgent'

type MakePropertiesRequired<T, K extends keyof T> = T & Required<Pick<T, K>>

// oxlint-disable-next-line typescript/no-restricted-types -- Preserve object schema generics, including interface types without index signatures.
type RuntimeConfigKeys<T extends object> = {
  [K in keyof T]-?: true
}

// oxlint-disable-next-line typescript/no-restricted-types -- Provider schemas accept arbitrary object and interface types without requiring index signatures.
interface ProviderRuntimeConfigSchema<TParameters extends object, TProviderConfig extends object> {
  additionalParameters: RuntimeConfigKeys<TParameters>
  provider: RuntimeConfigKeys<TProviderConfig>
}

interface ResolvedProviderRuntimeConfigSchema {
  // oxlint-disable-next-line typescript/no-restricted-types -- The registered schema retains the caller's object type after generic erasure.
  additionalParameters: object
  // oxlint-disable-next-line typescript/no-restricted-types -- The registered schema retains the caller's object type after generic erasure.
  provider: object
}

// oxlint-disable-next-line typescript/no-restricted-types -- WeakMap keys are provider objects, including caller interfaces without dictionary index signatures.
const providerRuntimeConfigSchemas = new WeakMap<object, ResolvedProviderRuntimeConfigSchema>()

type PossibleCombinations<T extends string, U extends string = T> = T extends string
  ? T | `${T} ${PossibleCombinations<Exclude<U, T>>}`
  : never

// oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- Provider metadata permits extension fields with values validated by their consumers.
export type OpenIdConfigurationMetadata = Record<string, unknown>

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
  // oxlint-disable-next-line typescript/no-restricted-types -- Keep known response-mode completion while permitting provider-specific strings in the public API.
  responseMode: 'query' | 'fragment' | 'form_post' | (string & {})
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
   * OpenID Configuration URL, object or function promise that resolves to an OpenID Configuration object.
   * A URL or object enables endpoint discovery: when authorizationUrl or tokenUrl is not configured,
   * endpoints that are not configured are discovered from it. Function-valued configurations are only
   * used for token validation, so missing endpoints still fail configuration validation.
   * A discovery URL must end in `/.well-known/openid-configuration` and its issuer must match the URL
   * prefix, allowing one terminal slash. HTTPS discovery URLs require HTTPS discovered endpoints.
   */
  openIdConfiguration?:
    | string
    | OpenIdConfigurationMetadata
    | ((config: OidcProviderConfig) => Promise<OpenIdConfigurationMetadata>)
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
   * Token validation behavior. Strict mode validates every enabled JWT in callback and refresh token responses without trusting decoded claims first.
   * Legacy mode only verifies a token when its decoded (unverified) audience matches and otherwise trusts the decoded claims, so it should only be used for backwards compatibility.
   * @default 'strict'
   */
  tokenValidationMode?: 'legacy' | 'strict'
  /**
   * Provider Only. Base URL for the provider, used when to dynamically create authorizationUrl, tokenUrl, userinfoUrl and logoutUrl if possible
   */
  baseUrl?: string
  /**
   * Space-delimited list of string values that specifies whether the authorization server prompts the user for reauthentication and consent
   */
  prompt?: 'none'[] | PossibleCombinations<'login' | 'consent' | 'select_account'>[]
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
   * Store the access token in the encrypted server side token store for `getAccessToken`, even
   * without a refresh token or token exposure. Requires a stable `NUXT_OIDC_TOKEN_KEY` and storage
   * shared by all server instances.
   * @default false
   */
  storeAccessToken?: boolean
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
   * Reserved OAuth/OIDC parameters cannot be overridden through this allowlist, except `prompt`.
   * An allowlisted client `prompt` must be `none`, `create`, or a space-separated combination of
   * `login`, `consent` and `select_account`. A valid value overrides `prompt` and
   * `additionalAuthParameters.prompt` for that request; invalid values are dropped.
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

// oxlint-disable-next-line anti-slop/no-unsafe-dictionary-type -- defu merges arbitrary provider extension values; the callback narrows each array before writing it.
type ProviderMergeTarget = Record<PropertyKey, unknown>

export const configMerger = createDefu(
  (obj: ProviderMergeTarget, key: PropertyKey, value: unknown) => {
    const currentValue = obj[key]
    if (Array.isArray(currentValue) && Array.isArray(value)) {
      const currentItems: unknown[] = currentValue
      const items: unknown[] = value
      obj[key] = key === 'requiredProperties' ? [...new Set([...currentItems, ...items])] : items
      return true
    }
    return false
  },
)

export function defineOidcProvider<
  // oxlint-disable-next-line typescript/no-restricted-types -- Preserve the public generic accepting parameter object and interface types.
  TConfig extends object,
  TRequired extends keyof (OidcProviderConfig & TProviderConfig),
  // oxlint-disable-next-line typescript/no-restricted-types -- Preserve the public provider extension generic and its object default.
  TProviderConfig extends object = object,
>(
  config: Partial<
    Omit<OidcProviderConfig, 'requiredProperties'> & {
      requiredProperties?: (keyof (TProviderConfig & OidcProviderConfig))[]
    }
  > &
    Partial<TProviderConfig> & {
      additionalAuthParameters?: Partial<TConfig>
      additionalTokenParameters?: Partial<TConfig>
      additionalLogoutParameters?: Partial<TConfig>
    },
  runtimeConfigSchema: ProviderRuntimeConfigSchema<TConfig, TProviderConfig>,
): MakePropertiesRequired<
  Partial<
    Defu<
      typeof config,
      [
        Partial<
          Omit<OidcProviderConfig, 'requiredProperties'> & {
            requiredProperties?: (keyof (TProviderConfig & OidcProviderConfig))[]
          }
        >,
      ]
    >
  >,
  TRequired & 'redirectUri'
> {
  const defaults: Partial<
    Omit<OidcProviderConfig, 'requiredProperties'> & {
      requiredProperties?: (keyof (TProviderConfig & OidcProviderConfig))[]
    }
  > = {
    clientId: '',
    redirectUri: '',
    clientSecret: '',
    authorizationUrl: '',
    tokenUrl: '',
    responseType: 'code',
    authenticationScheme: 'header',
    grantType: 'authorization_code',
    pkce: true,
    state: true,
    nonce: false,
    scope: ['openid'],
    scopeInTokenRequest: false,
    tokenRequestType: 'form',
    requiredProperties: ['clientId', 'redirectUri', 'clientSecret', 'authorizationUrl', 'tokenUrl'],
    validateAccessToken: true,
    validateIdToken: true,
    tokenValidationMode: 'strict',
    skipAccessTokenParsing: false,
    exposeAccessToken: false,
    exposeIdToken: false,
    storeAccessToken: false,
    callbackRedirectUrl: '/',
    allowedClientAuthParameters: undefined,
    logoutUrl: '',
    sessionConfiguration: {
      automaticRefresh: true,
      expirationThreshold: 0,
      expirationCheck: true,
      singleSignOut: false,
      singleSignOutIdField: 'sub',
      maxAuthSessionAge: undefined,
    },
    additionalAuthParameters: undefined,
    additionalTokenParameters: undefined,
    additionalLogoutParameters: undefined,
    excludeOfflineScopeFromTokenRequest: false,
  }
  const mergedConfig = configMerger(config, defaults)
  providerRuntimeConfigSchemas.set(mergedConfig, runtimeConfigSchema)
  // SAFETY: The provider definition preserves its existing caller-selected required-key mapping; defaults supply redirectUri.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Retain the public generic return contract of provider definitions.
  return mergedConfig as MakePropertiesRequired<
    Partial<typeof mergedConfig>,
    TRequired & 'redirectUri'
  >
}

export function getProviderRuntimeConfigSchema(
  // oxlint-disable-next-line typescript/no-restricted-types, anti-slop/no-object-parameters -- Lookup accepts the original provider object registered by defineOidcProvider.
  provider: object,
): ResolvedProviderRuntimeConfigSchema {
  return (
    providerRuntimeConfigSchemas.get(provider) ?? {
      additionalParameters: {},
      provider: {},
    }
  )
}

/**
 * ofetch reads the body after its error handling, so read it here: a body that does not arrive then
 * fails like a missing response.
 */
const fetchCompleteResponse: typeof fetch = async (input, init) => {
  const response = await fetch(input, init)
  const body = response.body === null ? null : await response.arrayBuffer()
  return new Response(body, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  })
}

const providerFetch = ofetch.create({}, { fetch: fetchCompleteResponse })

export async function createProviderFetch(config: OidcProviderConfig): Promise<$Fetch> {
  if (config.proxy !== undefined && config.proxy !== '') {
    return await getProxyAgentOfetch(
      config.proxy,
      config.ignoreProxyCertificateErrors,
      fetchCompleteResponse,
    )
  }
  return providerFetch
}

/** A provider request the provider did not answer, so a later attempt may still succeed. */
export class ProviderUnavailableError extends Error {
  override readonly name = 'ProviderUnavailableError'
}

/**
 * Whether a provider request failed without an answer from the provider: without a complete
 * response or with HTTP 408, 429 or 5xx. Any other response is the provider's answer.
 */
export function isProviderUnavailable(error: unknown): boolean {
  if (!(error instanceof FetchError)) {
    return false
  }
  const status = error.response?.status
  return status === undefined || status === 408 || status === 429 || status >= 500
}
