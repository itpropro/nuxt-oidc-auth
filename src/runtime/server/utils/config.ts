import type { ProviderConfigs, ProviderKeys } from '../../types'
import type { OidcProviderConfig } from './provider'
import { snakeCase } from 'scule'
import { cleanDoubleSlashes, joinURL, parseURL, withHttps, withoutTrailingSlash } from 'ufo'

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
  const missingProperties: string[] = []
  let valid = true
  for (const prop of requiredProps) {
    if (!(prop in (config as object))) {
      valid = false
      missingProperties.push(prop.toString())
    }
  }
  return { valid, missingProperties, config }
}

export function generateProviderUrl(baseUrl: string, relativeUrl?: string) {
  const parsedUrl = parseURL(baseUrl)
  return parsedUrl.protocol ? withoutTrailingSlash(cleanDoubleSlashes(joinURL(baseUrl, '/', relativeUrl || ''))) : withoutTrailingSlash(cleanDoubleSlashes(withHttps(joinURL(baseUrl, '/', relativeUrl || ''))))
}

export function replaceInjectedParameters(
  injectedParameters: Array<keyof OidcProviderConfig>,
  providerOptions: OidcProviderConfig,
  providerPreset: ProviderConfigs[keyof ProviderConfigs],
  provider: ProviderKeys,
): void {
  const additionalParameterKeys = ['additionalAuthParameters', 'additionalTokenParameters', 'additionalLogoutParameters'] as Array<keyof Pick<OidcProviderConfig, 'additionalAuthParameters' | 'additionalTokenParameters' | 'additionalLogoutParameters'>>
  additionalParameterKeys.forEach((parameterKey) => {
    const presetParams = providerPreset[parameterKey]
    if (!presetParams)
      return
    const providerParams = providerOptions[parameterKey]
    if (!providerParams) {
      providerOptions[parameterKey] = {}
    }
    Object.entries(presetParams).forEach(([key, value]) => {
      injectedParameters.forEach((injectedParameter) => {
        const placeholder = `{${injectedParameter}}`
        if ((value as string).includes(placeholder)) {
          providerOptions[parameterKey]![key] = (value as string).replace(
            placeholder,
            providerOptions[injectedParameter] as string || process.env[`NUXT_OIDC_PROVIDERS_${provider.toUpperCase()}_${snakeCase(injectedParameter).toUpperCase()}`] || '',
          )
        }
      })
    })
  })
}
