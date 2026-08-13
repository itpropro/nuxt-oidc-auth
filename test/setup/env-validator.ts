import { providerConfigs } from '../fixtures/providers'
import type { EnvValidationResult } from './types'

const UNDERSCORE_RE = /_/g

export function validateProviderEnv(providerName: string): EnvValidationResult {
  const config = providerConfigs.find(({ name }) => name === providerName)

  if (!config) {
    return {
      provider: providerName,
      configured: false,
      missingVars: [],
      presentVars: [],
    }
  }

  const missingVars: string[] = []
  const presentVars: string[] = []

  for (const envVar of config.requiredEnvVars) {
    if (process.env[envVar]) {
      presentVars.push(envVar)
    } else {
      missingVars.push(envVar)
    }
  }

  return {
    provider: providerName,
    configured: missingVars.length === 0,
    missingVars,
    presentVars,
  }
}

export function validateAllProviders(): EnvValidationResult[] {
  return providerConfigs.map(({ name }) => validateProviderEnv(name))
}

export function skipUnlessConfigured(providerName: string): void {
  const result = validateProviderEnv(providerName)

  if (!result.configured) {
    const config = providerConfigs.find(({ name }) => name === providerName)

    if (config?.offlineCapable) return

    console.warn(`\nSkipping ${providerName} tests - not configured`)
    if (result.missingVars.length > 0) {
      console.warn(`  Missing: ${result.missingVars.join(', ')}`)
    }
  }
}

export function isProviderConfigured(providerName: string): boolean {
  const config = providerConfigs.find(({ name }) => name === providerName)

  if (config?.offlineCapable) return true

  return validateProviderEnv(providerName).configured
}

export function printConfigurationStatus(): void {
  console.warn('\n📋 Provider Configuration Status:\n')

  for (const result of validateAllProviders()) {
    const config = providerConfigs.find(({ name }) => name === result.provider)
    const status = result.configured ? '✓' : '✗'
    const statusColor = result.configured ? '\x1B[32m' : '\x1B[31m'
    const resetColor = '\x1B[0m'

    let statusText = result.configured ? 'configured' : 'not configured'

    if (config?.offlineCapable) {
      statusText = 'offline'
    } else if (result.missingVars.length > 0) {
      statusText = `missing: ${result.missingVars.map((value) => value.replace('NUXT_OIDC_PROVIDERS_', '').replace(UNDERSCORE_RE, ' ')).join(', ')}`
    }

    console.warn(
      `${statusColor}${status}${resetColor} ${result.provider.padEnd(12)} - ${statusText}`,
    )
  }
}

if (process.argv.includes('--check')) printConfigurationStatus()
