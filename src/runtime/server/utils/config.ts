import { cleanDoubleSlashes, joinURL, parseURL, withHttps, withoutTrailingSlash } from 'ufo'

import type { ProviderSessionConfig } from '../../types'
import type { OidcProviderConfig, OpenIdConfigurationMetadata } from './provider'
import { configMerger, createProviderFetch, getProviderRuntimeConfigSchema } from './provider'

const PLACEHOLDER_RE = /\{(.*?)\}/gu
const RUNTIME_CONFIG_UNSET = '__NUXT_OIDC_RUNTIME_CONFIG_UNSET__'
const OPENID_CONFIGURATION_PATH = '/.well-known/openid-configuration'

type ProviderFetch = Awaited<ReturnType<typeof createProviderFetch>>

const DISCOVERED_ENDPOINTS = [
  { property: 'authorizationUrl', metadata: 'authorization_endpoint', optional: false },
  { property: 'tokenUrl', metadata: 'token_endpoint', optional: false },
  { property: 'userInfoUrl', metadata: 'userinfo_endpoint', optional: true },
  { property: 'logoutUrl', metadata: 'end_session_endpoint', optional: true },
] as const satisfies readonly {
  property: keyof OidcProviderConfig
  metadata: string
  optional: boolean
}[]

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
  requestTimeout: RUNTIME_CONFIG_UNSET,
  requiredProperties: RUNTIME_CONFIG_UNSET,
  responseMode: RUNTIME_CONFIG_UNSET,
  responseType: RUNTIME_CONFIG_UNSET,
  scope: RUNTIME_CONFIG_UNSET,
  scopeInTokenRequest: RUNTIME_CONFIG_UNSET,
  sessionConfiguration: PROVIDER_SESSION_RUNTIME_CONFIG_SCHEMA,
  skipAccessTokenParsing: RUNTIME_CONFIG_UNSET,
  state: RUNTIME_CONFIG_UNSET,
  storeAccessToken: RUNTIME_CONFIG_UNSET,
  tokenRequestType: RUNTIME_CONFIG_UNSET,
  tokenUrl: RUNTIME_CONFIG_UNSET,
  tokenValidationMode: RUNTIME_CONFIG_UNSET,
  userInfoUrl: RUNTIME_CONFIG_UNSET,
  userNameClaim: RUNTIME_CONFIG_UNSET,
  validateAccessToken: RUNTIME_CONFIG_UNSET,
  validateIdToken: RUNTIME_CONFIG_UNSET,
} as const satisfies Required<Record<SerializableProviderKey, typeof RUNTIME_CONFIG_UNSET>> & {
  sessionConfiguration: typeof PROVIDER_SESSION_RUNTIME_CONFIG_SCHEMA
}

type ProviderConfigSource = Partial<Omit<OidcProviderConfig, 'requiredProperties'>> & {
  requiredProperties?: string[]
}

export { configMerger } from './provider'

export interface ValidationResult<T> {
  valid: boolean
  missingProperties: string[]
  emptyProperties: string[]
  invalidProperties: string[]
  config: T
}

export type ProviderConfigFlow = 'login' | 'callback' | 'refresh' | 'logout'

/**
 * Validate a configuration object
 * @param config The configuration object to validate
 * @returns ValidationResult object with the validation result and the validated config stripped of optional properties
 */
export function validateConfig<T>(config: T, requiredProps: string[]): ValidationResult<T> {
  const missingProperties: string[] = []
  const emptyProperties: string[] = []
  for (const prop of requiredProps) {
    const descriptor = Object.getOwnPropertyDescriptor(config, prop)
    const readValue = (): unknown => {
      const currentDescriptor = Object.getOwnPropertyDescriptor(config, prop)
      if (currentDescriptor?.get !== undefined) {
        return currentDescriptor.get.call(config)
      }
      return currentDescriptor?.value
    }
    if (descriptor === undefined || readValue() === undefined) {
      missingProperties.push(prop)
      continue
    }

    const value = readValue()
    if (value === null || (typeof value === 'string' && value.trim().length === 0)) {
      emptyProperties.push(prop)
    }
  }
  return {
    valid: missingProperties.length === 0 && emptyProperties.length === 0,
    missingProperties,
    emptyProperties,
    invalidProperties: [],
    config,
  }
}

export function generateProviderUrl(baseUrl: string, relativeUrl?: string): string {
  const parsedUrl = parseURL(baseUrl)
  return parsedUrl.protocol !== undefined && parsedUrl.protocol !== ''
    ? withoutTrailingSlash(cleanDoubleSlashes(joinURL(baseUrl, '/', relativeUrl ?? '')))
    : withoutTrailingSlash(cleanDoubleSlashes(withHttps(joinURL(baseUrl, '/', relativeUrl ?? ''))))
}

function isResolvedString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function replaceProviderPlaceholders(baseUrl: string, config: OidcProviderConfig): string {
  let resolvedBaseUrl = baseUrl
  for (const match of baseUrl.matchAll(PLACEHOLDER_RE)) {
    const key = match[1]
    if (key === undefined || key === '') {
      continue
    }

    // oxlint-disable-next-line anti-slop/no-reflect-get -- Configured placeholders can name provider extension keys; narrow the dynamic value before formatting it.
    const value: unknown = Reflect.get(config, key)
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
  allowEmpty = false,
): string | undefined {
  if (allowEmpty && explicitValue === '') {
    return ''
  }
  if (isResolvedString(explicitValue) && explicitValue !== presetValue) {
    return baseUrl === undefined || baseUrl === '' || Boolean(parseURL(explicitValue).protocol)
      ? explicitValue
      : generateProviderUrl(baseUrl, explicitValue)
  }
  if (!isResolvedString(presetValue)) {
    return isResolvedString(explicitValue) ? explicitValue : undefined
  }
  if (baseUrl === undefined || baseUrl === '' || Boolean(parseURL(presetValue).protocol)) {
    return presetValue
  }
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
  // SAFETY: Runtime shapes deliberately use sentinels in the existing provider config slots; resolveProviderConfig removes them before validating values.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Nuxt sentinel slots preserve the public runtime shape contract.
  const runtimeShape = configMerger(
    providerSpecificShape,
    createRuntimeConfigShape(providerPreset),
    createRuntimeConfigShape(PROVIDER_RUNTIME_CONFIG_SCHEMA),
  ) as ProviderConfigSource
  return configMerger(configuredProvider ?? {}, runtimeShape)
}

interface ProviderRuntimeConfigShape {
  [property: string]: typeof RUNTIME_CONFIG_UNSET | ProviderRuntimeConfigShape
}

// oxlint-disable-next-line typescript/no-restricted-types, anti-slop/no-object-parameters -- Registered provider extension schemas retain arbitrary object/interface keys without dictionary index signatures.
function createRuntimeConfigShape(config: object): ProviderRuntimeConfigShape {
  const shape: ProviderRuntimeConfigShape = {}
  for (const [key, entryValue] of Object.entries(config)) {
    const value: unknown = entryValue
    if (typeof value === 'function') {
      continue
    }
    shape[key] =
      value !== null && typeof value === 'object' && !Array.isArray(value)
        ? createRuntimeConfigShape(value)
        : RUNTIME_CONFIG_UNSET
  }
  return shape
}

function removeRuntimeConfigSentinels(value: unknown): unknown {
  if (value === RUNTIME_CONFIG_UNSET) {
    return undefined
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => removeRuntimeConfigSentinels(item))
  }
  if (value === null || typeof value !== 'object') {
    return value
  }

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
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- Preserve the explicit generic argument supported by the public resolver API.
export function resolveProviderConfig<TProviderConfig extends ProviderConfigSource>(
  runtimeConfig: TProviderConfig | undefined,
  providerPreset: ProviderConfigSource,
): OidcProviderConfig {
  // SAFETY: The existing runtime source is a provider config; normalization only removes sentinel values while preserving all configured values and extension fields.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Retain the public provider source type after recursive sentinel removal.
  const explicitConfig = removeRuntimeConfigSentinels(runtimeConfig ?? {}) as ProviderConfigSource
  // SAFETY: Preserve the resolver's public result contract; flow-specific validation rejects missing required values before protocol use.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Full provider typing is the established resolver API even while invalid configurations await validation.
  const config = configMerger(explicitConfig, providerPreset) as OidcProviderConfig
  const baseUrl = isResolvedString(config.baseUrl)
    ? replaceProviderPlaceholders(config.baseUrl, config)
    : undefined

  if (baseUrl !== undefined && baseUrl !== '') {
    config.baseUrl = baseUrl
  }

  const authorizationUrl = resolveProviderEndpoint(
    explicitConfig.authorizationUrl,
    providerPreset.authorizationUrl,
    baseUrl,
  )
  if (authorizationUrl !== undefined && authorizationUrl !== '') {
    config.authorizationUrl = authorizationUrl
  }
  const tokenUrl = resolveProviderEndpoint(
    explicitConfig.tokenUrl,
    providerPreset.tokenUrl,
    baseUrl,
  )
  if (tokenUrl !== undefined && tokenUrl !== '') {
    config.tokenUrl = tokenUrl
  }
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
  if (typeof config.openIdConfiguration === 'string') {
    const openIdConfiguration = resolveProviderEndpoint(
      explicitConfig.openIdConfiguration,
      providerPreset.openIdConfiguration,
      baseUrl,
    )
    if (openIdConfiguration !== undefined && openIdConfiguration !== '') {
      config.openIdConfiguration = openIdConfiguration
    }
  }

  replaceInjectedParameters(['clientId'], config, providerPreset)
  return config
}

/**
 * Resolve a runtime provider configuration including endpoints discovered from
 * `openIdConfiguration`. Use this before running a login, callback, refresh, or logout flow.
 */
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- Preserve the explicit generic argument supported by the public resolver API.
export async function resolveEffectiveProviderConfig<TProviderConfig extends ProviderConfigSource>(
  runtimeConfig: TProviderConfig | undefined,
  providerPreset: ProviderConfigSource,
): Promise<OidcProviderConfig> {
  return await discoverProviderEndpoints(resolveProviderConfig(runtimeConfig, providerPreset))
}

export async function loadOpenIdConfiguration(
  config: OidcProviderConfig,
  customFetch: ProviderFetch,
): Promise<OpenIdConfigurationMetadata> {
  const source = config.openIdConfiguration
  if (source === undefined) {
    throw new Error('OpenID configuration is not configured')
  }
  let metadata: unknown = source
  if (typeof source === 'function') {
    metadata = await source(config)
  } else if (typeof source === 'string') {
    metadata = await customFetch<unknown>(source)
  }
  if (!isJsonObject(metadata)) {
    throw new Error('OpenID configuration must be a JSON object')
  }
  return metadata
}

function isJsonObject(value: unknown): value is OpenIdConfigurationMetadata {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Fill endpoints that are not configured from OpenID Provider metadata. Discovery runs only when
 * `openIdConfiguration` is a URL or object and the authorization or token endpoint is missing. The loaded
 * metadata replaces `openIdConfiguration`, so token validation in the same flow reuses it.
 */
async function discoverProviderEndpoints(config: OidcProviderConfig): Promise<OidcProviderConfig> {
  if (
    config.openIdConfiguration === undefined ||
    typeof config.openIdConfiguration === 'function' ||
    (isResolvedString(config.authorizationUrl) && isResolvedString(config.tokenUrl))
  ) {
    return config
  }

  const discoveryUrl =
    typeof config.openIdConfiguration === 'string' ? config.openIdConfiguration : undefined
  if (
    discoveryUrl !== undefined &&
    (!isAbsoluteHttpUrl(discoveryUrl) || !discoveryUrl.endsWith(OPENID_CONFIGURATION_PATH))
  ) {
    throw new Error(
      `openIdConfiguration must be an absolute URL ending in ${OPENID_CONFIGURATION_PATH} to discover provider endpoints`,
    )
  }

  const openIdConfiguration = await loadOpenIdConfiguration(
    config,
    await createProviderFetch(config),
  )

  // Discovery removes a trailing issuer slash when constructing the metadata URL.
  const expectedIssuer = discoveryUrl?.slice(0, -OPENID_CONFIGURATION_PATH.length)
  if (
    expectedIssuer !== undefined &&
    openIdConfiguration['issuer'] !== expectedIssuer &&
    openIdConfiguration['issuer'] !== `${expectedIssuer}/`
  ) {
    throw new Error(
      `OpenID configuration issuer ${JSON.stringify(openIdConfiguration['issuer'])} does not match the expected issuer "${expectedIssuer}"`,
    )
  }

  const requiresHttps = discoveryUrl !== undefined && new URL(discoveryUrl).protocol === 'https:'
  const jwksUri = openIdConfiguration['jwks_uri']
  if (
    jwksUri !== undefined &&
    (!isAbsoluteHttpUrl(jwksUri) || (requiresHttps && new URL(jwksUri).protocol !== 'https:'))
  ) {
    throw new Error('OpenID configuration has an invalid jwks_uri')
  }

  const discoveredConfig: OidcProviderConfig = { ...config, openIdConfiguration }
  for (const endpoint of DISCOVERED_ENDPOINTS) {
    const configuredValue = config[endpoint.property]
    if ((endpoint.optional && configuredValue === '') || isResolvedString(configuredValue)) {
      continue
    }
    const discoveredValue = openIdConfiguration[endpoint.metadata]
    if (discoveredValue === undefined) {
      continue
    }
    if (
      !isAbsoluteHttpUrl(discoveredValue) ||
      (requiresHttps && new URL(discoveredValue).protocol !== 'https:')
    ) {
      throw new Error(`OpenID configuration has an invalid ${endpoint.metadata}`)
    }
    discoveredConfig[endpoint.property] = discoveredValue
  }
  return discoveredConfig
}

const FLOW_REQUIRED_PROPERTIES: Record<ProviderConfigFlow, Set<keyof OidcProviderConfig>> = {
  login: new Set(['authorizationUrl', 'clientId', 'redirectUri']),
  callback: new Set(['clientId', 'clientSecret', 'redirectUri', 'tokenUrl']),
  refresh: new Set(['clientId', 'clientSecret', 'tokenUrl']),
  logout: new Set(),
}

const FLOW_SCOPED_PROPERTIES = new Set<keyof OidcProviderConfig>([
  'authorizationUrl',
  'baseUrl',
  'clientId',
  'clientSecret',
  'logoutRedirectUri',
  'redirectUri',
  'tokenUrl',
])

function isAbsoluteHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false
  }
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function isRelativeUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    (parseURL(value).protocol === undefined || parseURL(value).protocol === '')
  )
}

function getProviderFlowEndpointProperties(
  config: OidcProviderConfig,
  flow: ProviderConfigFlow,
): (keyof OidcProviderConfig)[] {
  let properties: (keyof OidcProviderConfig)[]
  switch (flow) {
    case 'login': {
      properties = ['authorizationUrl']
      break
    }
    case 'callback': {
      properties = ['tokenUrl', 'userInfoUrl']
      break
    }
    case 'refresh': {
      properties = ['tokenUrl']
      break
    }
    case 'logout': {
      properties = ['logoutUrl']
      break
    }
  }
  if (
    (flow === 'callback' || flow === 'refresh') &&
    (Boolean(config.validateAccessToken) || Boolean(config.validateIdToken)) &&
    typeof config.openIdConfiguration === 'function' &&
    config.requiredProperties.includes('authorizationUrl')
  ) {
    properties.push('authorizationUrl')
  }
  return properties
}

function providerFlowNeedsBaseUrl(config: OidcProviderConfig, flow: ProviderConfigFlow): boolean {
  if (
    getProviderFlowEndpointProperties(config, flow).some((property) =>
      isRelativeUrl(config[property]),
    )
  ) {
    return true
  }

  if (flow !== 'callback' && flow !== 'refresh') {
    return false
  }
  const validationEnabled = Boolean(config.validateAccessToken) || Boolean(config.validateIdToken)
  if (!validationEnabled) {
    return false
  }
  if (typeof config.openIdConfiguration === 'string') {
    return isRelativeUrl(config.openIdConfiguration)
  }
  return (
    typeof config.openIdConfiguration === 'function' &&
    config.requiredProperties.includes('baseUrl')
  )
}

export function getRequiredProviderProperties(
  config: OidcProviderConfig,
  flow: ProviderConfigFlow = 'callback',
): string[] {
  const flowProperties = FLOW_REQUIRED_PROPERTIES[flow]
  const requiredProperties = config.requiredProperties.filter((property) => {
    if (property === 'clientSecret' && config.authenticationScheme === 'none') {
      return false
    }
    if (property === 'baseUrl') {
      return providerFlowNeedsBaseUrl(config, flow)
    }
    return !FLOW_SCOPED_PROPERTIES.has(property) || flowProperties.has(property)
  })
  if (flow === 'logout' && isResolvedString(config.logoutUrl)) {
    if (config.requiredProperties.includes('logoutRedirectUri')) {
      requiredProperties.push('logoutRedirectUri')
    }
    if (Object.hasOwn(config.additionalLogoutParameters ?? {}, 'clientId')) {
      requiredProperties.push('clientId')
    }
  }
  if (
    (flow === 'callback' || flow === 'refresh') &&
    (Boolean(config.validateAccessToken) || Boolean(config.validateIdToken)) &&
    typeof config.openIdConfiguration === 'function' &&
    config.requiredProperties.includes('authorizationUrl')
  ) {
    requiredProperties.push('authorizationUrl')
  }
  if (providerFlowNeedsBaseUrl(config, flow)) {
    requiredProperties.push('baseUrl')
  }
  if ((flow === 'callback' || flow === 'refresh') && config.tokenValidationMode === 'strict') {
    const validateAccessToken = Boolean(config.validateAccessToken)
    if (validateAccessToken) {
      requiredProperties.push('audience')
    }
    if (validateAccessToken || Boolean(config.validateIdToken)) {
      requiredProperties.push('openIdConfiguration')
    }
  }
  return [...new Set(requiredProperties)]
}

export function validateProviderConfig(
  config: OidcProviderConfig,
  flow: ProviderConfigFlow = 'callback',
): ValidationResult<OidcProviderConfig> {
  const result = validateConfig(config, getRequiredProviderProperties(config, flow))
  const tokenValidationMode: unknown = config.tokenValidationMode
  if (
    flow !== 'logout' &&
    tokenValidationMode !== undefined &&
    tokenValidationMode !== 'legacy' &&
    tokenValidationMode !== 'strict'
  ) {
    result.valid = false
    result.invalidProperties = [...new Set([...result.invalidProperties, 'tokenValidationMode'])]
  }
  for (const endpointProperty of getProviderFlowEndpointProperties(config, flow)) {
    const endpoint = config[endpointProperty]
    if (
      typeof endpoint === 'string' &&
      endpoint.trim().length > 0 &&
      !isAbsoluteHttpUrl(endpoint) &&
      !isRelativeUrl(endpoint)
    ) {
      result.valid = false
      result.invalidProperties.push(endpointProperty)
    }
  }
  if (
    (flow === 'callback' || flow === 'refresh') &&
    typeof config.openIdConfiguration === 'string' &&
    !isAbsoluteHttpUrl(config.openIdConfiguration) &&
    !isRelativeUrl(config.openIdConfiguration)
  ) {
    result.valid = false
    result.invalidProperties.push('openIdConfiguration')
  }
  const requestTimeout: unknown = config.requestTimeout
  if (
    requestTimeout !== undefined &&
    (typeof requestTimeout !== 'number' || !Number.isFinite(requestTimeout) || requestTimeout <= 0)
  ) {
    result.valid = false
    result.invalidProperties.push('requestTimeout')
  }
  result.invalidProperties = [...new Set(result.invalidProperties)]
  return result
}

export function formatProviderConfigValidation(
  result: ValidationResult<OidcProviderConfig>,
): string {
  return [
    result.missingProperties.length > 0 && `missing: ${result.missingProperties.join(', ')}`,
    result.emptyProperties.length > 0 && `empty: ${result.emptyProperties.join(', ')}`,
    result.invalidProperties.length > 0 && `invalid: ${result.invalidProperties.join(', ')}`,
  ]
    .filter(Boolean)
    .join('; ')
}

export function replaceInjectedParameters(
  injectedParameters: (keyof OidcProviderConfig)[],
  providerOptions: OidcProviderConfig,
  providerPreset: ProviderConfigSource,
): void {
  const additionalParameterKeys = [
    'additionalAuthParameters',
    'additionalTokenParameters',
    'additionalLogoutParameters',
  ] as const
  for (const parameterKey of additionalParameterKeys) {
    const presetParams = providerPreset[parameterKey]
    if (presetParams === undefined) {
      continue
    }
    const parameters = { ...providerOptions[parameterKey] }
    providerOptions[parameterKey] = parameters
    for (const [key, value] of Object.entries(presetParams)) {
      for (const injectedParameter of injectedParameters) {
        const placeholder = `{${injectedParameter}}`
        if (value.includes(placeholder)) {
          const replacement = providerOptions[injectedParameter]
          // SAFETY: Injection substitutes the same configured value as the public provider contract; String.replace performs its existing string coercion.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Injected provider values retain the existing replacement coercion rather than changing accepted configuration.
          parameters[key] = value.replace(placeholder, (replacement as string) || '')
        }
      }
    }
  }
}
