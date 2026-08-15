import type { ProviderSessionConfig } from '../../types'
import type { OidcProviderConfig } from './provider'
import { createDefu } from 'defu'
import { cleanDoubleSlashes, joinURL, parseURL, withHttps, withoutTrailingSlash } from 'ufo'
import { getProviderRuntimeConfigSchema } from './provider'

const PLACEHOLDER_RE = /\{(.*?)\}/g
const RUNTIME_CONFIG_UNSET = '__NUXT_OIDC_RUNTIME_CONFIG_UNSET__'

type ProviderKeyWithoutSession = Exclude<keyof OidcProviderConfig, 'sessionConfiguration'>

type SerializableProviderKey = {
  [K in ProviderKeyWithoutSession]-?: Exclude<OidcProviderConfig[K], null | undefined> extends (
    ...args: never[]
  ) => unknown
    ? never
    : K
}[ProviderKeyWithoutSession]

const PROVIDER_SESSION_RUNTIME_CONFIG_SCHEMA = {
  automaticRefresh: RUNTIME_CONFIG_UNSET,
  cookieName: RUNTIME_CONFIG_UNSET,
  expirationCheck: RUNTIME_CONFIG_UNSET,
  expirationThreshold: RUNTIME_CONFIG_UNSET,
  maxAuthSessionAge: RUNTIME_CONFIG_UNSET,
  missingPersistentSession: RUNTIME_CONFIG_UNSET,
  singleSignOut: RUNTIME_CONFIG_UNSET,
  singleSignOutIdField: RUNTIME_CONFIG_UNSET,
} as const satisfies {
  [K in keyof ProviderSessionConfig]-?: typeof RUNTIME_CONFIG_UNSET
}

const PROVIDER_RUNTIME_CONFIG_SCHEMA = {
  additionalAuthParameters: RUNTIME_CONFIG_UNSET,
  additionalLogoutParameters: RUNTIME_CONFIG_UNSET,
  additionalTokenParameters: RUNTIME_CONFIG_UNSET,
  allowedCallbackRedirectUrls: RUNTIME_CONFIG_UNSET,
  allowedClientAuthParameters: RUNTIME_CONFIG_UNSET,
  audience: RUNTIME_CONFIG_UNSET,
  authenticationScheme: RUNTIME_CONFIG_UNSET,
  authorizationUrl: RUNTIME_CONFIG_UNSET,
  baseUrl: RUNTIME_CONFIG_UNSET,
  callbackRedirectUrl: RUNTIME_CONFIG_UNSET,
  clientId: RUNTIME_CONFIG_UNSET,
  clientSecret: RUNTIME_CONFIG_UNSET,
  encodeRedirectUri: RUNTIME_CONFIG_UNSET,
  excludeOfflineScopeFromTokenRequest: RUNTIME_CONFIG_UNSET,
  exposeAccessToken: RUNTIME_CONFIG_UNSET,
  exposeIdToken: RUNTIME_CONFIG_UNSET,
  filterUserInfo: RUNTIME_CONFIG_UNSET,
  grantType: RUNTIME_CONFIG_UNSET,
  ignoreProxyCertificateErrors: RUNTIME_CONFIG_UNSET,
  logoutRedirectParameterName: RUNTIME_CONFIG_UNSET,
  logoutRedirectUri: RUNTIME_CONFIG_UNSET,
  logoutUrl: RUNTIME_CONFIG_UNSET,
  nonce: RUNTIME_CONFIG_UNSET,
  openIdConfiguration: RUNTIME_CONFIG_UNSET,
  optionalClaims: RUNTIME_CONFIG_UNSET,
  pkce: RUNTIME_CONFIG_UNSET,
  prompt: RUNTIME_CONFIG_UNSET,
  proxy: RUNTIME_CONFIG_UNSET,
  redirectUri: RUNTIME_CONFIG_UNSET,
  requiredProperties: RUNTIME_CONFIG_UNSET,
  responseMode: RUNTIME_CONFIG_UNSET,
  responseType: RUNTIME_CONFIG_UNSET,
  scope: RUNTIME_CONFIG_UNSET,
  scopeInTokenRequest: RUNTIME_CONFIG_UNSET,
  sessionConfiguration: PROVIDER_SESSION_RUNTIME_CONFIG_SCHEMA,
  skipAccessTokenParsing: RUNTIME_CONFIG_UNSET,
  state: RUNTIME_CONFIG_UNSET,
  tokenRequestType: RUNTIME_CONFIG_UNSET,
  tokenUrl: RUNTIME_CONFIG_UNSET,
  tokenValidationMode: RUNTIME_CONFIG_UNSET,
  userInfoUrl: RUNTIME_CONFIG_UNSET,
  userNameClaim: RUNTIME_CONFIG_UNSET,
  validateAccessToken: RUNTIME_CONFIG_UNSET,
  validateIdToken: RUNTIME_CONFIG_UNSET,
} as const satisfies {
  [K in SerializableProviderKey]-?: typeof RUNTIME_CONFIG_UNSET
} & {
  sessionConfiguration: typeof PROVIDER_SESSION_RUNTIME_CONFIG_SCHEMA
}

type ProviderConfigSource = Partial<Omit<OidcProviderConfig, 'requiredProperties'>> & {
  requiredProperties?: string[]
}

// Custom defu config merger to replace default values instead of merging them, except for requiredProperties
export const configMerger = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key]) && Array.isArray(value)) {
    // oxlint-disable-next-line typescript-eslint/no-explicit-any -- defu merger callback requires flexible assignment
    obj[key] = (key === 'requiredProperties' ? [...new Set([...obj[key], ...value])] : value) as any
    return true
  }
})

export interface ValidationResult<T> {
  valid: boolean
  missingProperties?: string[]
  config: T
}

/**
 * Validate a configuration object
 * @param config The configuration object to validate
 * @returns ValidationResult object with the validation result and the validated config stripped of optional properties
 */
export function validateConfig<T>(config: T, requiredProps: string[]): ValidationResult<T> {
  const configObject = config as Record<string, unknown>
  const missingProperties: string[] = []
  let valid = true
  for (const prop of requiredProps) {
    if (!Object.hasOwn(configObject, prop)) {
      valid = false
      missingProperties.push(prop.toString())
      continue
    }

    const value = configObject[prop]
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim().length === 0)
    ) {
      valid = false
      missingProperties.push(prop.toString())
    }
  }
  return { valid, missingProperties, config }
}

export function generateProviderUrl(baseUrl: string, relativeUrl?: string) {
  const parsedUrl = parseURL(baseUrl)
  return parsedUrl.protocol
    ? withoutTrailingSlash(cleanDoubleSlashes(joinURL(baseUrl, '/', relativeUrl || '')))
    : withoutTrailingSlash(cleanDoubleSlashes(withHttps(joinURL(baseUrl, '/', relativeUrl || ''))))
}

function isResolvedString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function replaceProviderPlaceholders(
  baseUrl: string,
  config: OidcProviderConfig & Record<string, unknown>,
): string {
  let resolvedBaseUrl = baseUrl
  for (const match of baseUrl.matchAll(PLACEHOLDER_RE)) {
    const key = match[1]
    if (!key) continue

    const value = config[key]
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      resolvedBaseUrl = resolvedBaseUrl.replace(match[0], String(value))
    }
  }
  return resolvedBaseUrl
}

function resolveProviderEndpoint(
  explicitValue: unknown,
  presetValue: unknown,
  baseUrl: string | undefined,
  allowEmpty: boolean = false,
): string | undefined {
  if (allowEmpty && explicitValue === '') return ''
  if (isResolvedString(explicitValue) && explicitValue !== presetValue) {
    return !baseUrl || parseURL(explicitValue).protocol
      ? explicitValue
      : generateProviderUrl(baseUrl, explicitValue)
  }
  if (!isResolvedString(presetValue)) {
    return isResolvedString(explicitValue) ? explicitValue : undefined
  }
  if (!baseUrl || parseURL(presetValue).protocol) return presetValue
  return generateProviderUrl(baseUrl, presetValue)
}

export function createProviderRuntimeConfig(
  configuredProvider: ProviderConfigSource | undefined,
  providerPreset: ProviderConfigSource,
): ProviderConfigSource {
  const runtimeConfigSchema = getProviderRuntimeConfigSchema(providerPreset)
  const parameterSchema = runtimeConfigSchema.additionalParameters
  const providerSpecificShape = {
    ...createRuntimeConfigShape(runtimeConfigSchema.provider),
    ...(Object.keys(parameterSchema).length > 0 && {
      additionalAuthParameters: createRuntimeConfigShape(parameterSchema),
      additionalLogoutParameters: createRuntimeConfigShape(parameterSchema),
      additionalTokenParameters: createRuntimeConfigShape(parameterSchema),
    }),
  }
  const runtimeShape = configMerger(
    providerSpecificShape,
    createRuntimeConfigShape(providerPreset),
    createRuntimeConfigShape(PROVIDER_RUNTIME_CONFIG_SCHEMA),
  ) as ProviderConfigSource
  return configMerger(configuredProvider || {}, runtimeShape) as ProviderConfigSource
}

function createRuntimeConfigShape(config: object): Record<string, unknown> {
  const shape: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'function') continue
    shape[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? createRuntimeConfigShape(value)
        : RUNTIME_CONFIG_UNSET
  }
  return shape
}

function removeRuntimeConfigSentinels(value: unknown): unknown {
  if (value === RUNTIME_CONFIG_UNSET) return undefined
  if (Array.isArray(value)) return value.map(removeRuntimeConfigSentinels)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nestedValue]) => {
      const resolvedValue = removeRuntimeConfigSentinels(nestedValue)
      return resolvedValue === undefined ? [] : [[key, resolvedValue]]
    }),
  )
}

export function hasExplicitProviderConfig(
  runtimeConfig: ProviderConfigSource | undefined,
  property: keyof OidcProviderConfig,
): boolean {
  return runtimeConfig?.[property] !== undefined && runtimeConfig[property] !== RUNTIME_CONFIG_UNSET
}

/**
 * Resolve a runtime provider configuration before validating or using it.
 * Runtime config already contains Nuxt environment overrides, so it takes
 * precedence over provider and library defaults.
 */
export function resolveProviderConfig<TProviderConfig extends ProviderConfigSource>(
  runtimeConfig: TProviderConfig | undefined,
  providerPreset: ProviderConfigSource,
): OidcProviderConfig {
  const explicitConfig = removeRuntimeConfigSentinels(runtimeConfig || {}) as ProviderConfigSource
  const config = configMerger(explicitConfig, providerPreset) as OidcProviderConfig &
    Record<string, unknown>
  const baseUrl = isResolvedString(config.baseUrl)
    ? replaceProviderPlaceholders(config.baseUrl, config)
    : undefined

  if (baseUrl) config.baseUrl = baseUrl

  config.authorizationUrl =
    resolveProviderEndpoint(
      explicitConfig.authorizationUrl,
      providerPreset.authorizationUrl,
      baseUrl,
    ) || config.authorizationUrl
  config.tokenUrl =
    resolveProviderEndpoint(explicitConfig.tokenUrl, providerPreset.tokenUrl, baseUrl) ||
    config.tokenUrl
  config.userInfoUrl = resolveProviderEndpoint(
    explicitConfig.userInfoUrl,
    providerPreset.userInfoUrl,
    baseUrl,
    true,
  )
  config.logoutUrl = resolveProviderEndpoint(
    explicitConfig.logoutUrl,
    providerPreset.logoutUrl,
    baseUrl,
    true,
  )

  replaceInjectedParameters(['clientId'], config, providerPreset)
  return config
}

export function getRequiredProviderProperties(config: OidcProviderConfig): string[] {
  const requiredProperties = config.requiredProperties.filter(
    (property) => property !== 'clientSecret' || config.authenticationScheme !== 'none',
  )
  if (config.tokenValidationMode === 'strict') {
    if (config.validateAccessToken) requiredProperties.push('audience')
    if (config.validateAccessToken || config.validateIdToken) {
      requiredProperties.push('openIdConfiguration')
    }
  }
  return [...new Set(requiredProperties)]
}

export function validateProviderConfig(
  config: OidcProviderConfig,
): ValidationResult<OidcProviderConfig> {
  const result = validateConfig(config, getRequiredProviderProperties(config))
  if (
    config.tokenValidationMode !== undefined &&
    config.tokenValidationMode !== 'legacy' &&
    config.tokenValidationMode !== 'strict'
  ) {
    result.valid = false
    result.missingProperties = [
      ...new Set([...(result.missingProperties || []), 'tokenValidationMode']),
    ]
  }
  return result
}

export function replaceInjectedParameters(
  injectedParameters: Array<keyof OidcProviderConfig>,
  providerOptions: OidcProviderConfig,
  providerPreset: ProviderConfigSource,
): void {
  const additionalParameterKeys = [
    'additionalAuthParameters',
    'additionalTokenParameters',
    'additionalLogoutParameters',
  ] as Array<
    keyof Pick<
      OidcProviderConfig,
      'additionalAuthParameters' | 'additionalTokenParameters' | 'additionalLogoutParameters'
    >
  >
  additionalParameterKeys.forEach((parameterKey) => {
    const presetParams = providerPreset[parameterKey]
    if (!presetParams) return
    providerOptions[parameterKey] = { ...providerOptions[parameterKey] }
    Object.entries(presetParams).forEach(([key, value]) => {
      injectedParameters.forEach((injectedParameter) => {
        const placeholder = `{${injectedParameter}}`
        if ((value as string).includes(placeholder)) {
          providerOptions[parameterKey]![key] = (value as string).replace(
            placeholder,
            (providerOptions[injectedParameter] as string) || '',
          )
        }
      })
    })
  })
}
