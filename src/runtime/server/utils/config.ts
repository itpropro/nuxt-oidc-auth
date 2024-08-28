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
