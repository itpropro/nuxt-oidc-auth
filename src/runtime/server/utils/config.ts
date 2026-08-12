import type { OidcProviderConfig } from './provider'
import { createDefu } from 'defu'
import { cleanDoubleSlashes, joinURL, parseURL, withHttps, withoutTrailingSlash } from 'ufo'

const PLACEHOLDER_RE = /\{(.*?)\}/g

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
): string | undefined {
  if (isResolvedString(explicitValue) && explicitValue !== presetValue) return explicitValue
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
  const runtimeShape = createRuntimeConfigShape(providerPreset) as ProviderConfigSource
  return configMerger(configuredProvider || {}, runtimeShape) as ProviderConfigSource
}

function createRuntimeConfigShape(config: object): Record<string, unknown> {
  const shape: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config)) {
    if (typeof value === 'function') continue
    shape[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? createRuntimeConfigShape(value)
        : null
  }
  return shape
}

/**
 * Resolve a runtime provider configuration before validating or using it.
 * Runtime config already contains Nuxt environment overrides, so it takes
 * precedence over provider and library defaults.
 */
export function resolveProviderConfig(
  runtimeConfig: ProviderConfigSource | undefined,
  providerPreset: ProviderConfigSource,
): OidcProviderConfig {
  const explicitConfig = runtimeConfig || {}
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
  )
  config.logoutUrl = resolveProviderEndpoint(
    explicitConfig.logoutUrl,
    providerPreset.logoutUrl,
    baseUrl,
  )

  replaceInjectedParameters(['clientId'], config, providerPreset)
  return config
}

export function getRequiredProviderProperties(config: OidcProviderConfig): string[] {
  return config.requiredProperties.filter(
    (property) => property !== 'clientSecret' || config.authenticationScheme !== 'none',
  )
}

export function validateProviderConfig(
  config: OidcProviderConfig,
): ValidationResult<OidcProviderConfig> {
  return validateConfig(config, getRequiredProviderProperties(config))
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
