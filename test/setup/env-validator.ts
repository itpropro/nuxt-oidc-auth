/**
 * Environment Validator for Provider Tests
 *
 * Validates that required environment variables are present for provider-specific tests.
 * Provider tests that are not configured will be skipped with a clear warning.
 */

import type { EnvValidationResult, TestProviderConfig } from './types'

/**
 * Provider configuration with required environment variables
 */
export const providerConfigs: Record<string, TestProviderConfig> = {
  oidc: {
    name: 'oidc',
    enabled: true,
    requiredEnvVars: [], // Generic OIDC uses mock provider, no env vars needed
    offlineCapable: true,
    config: {},
  },
  auth0: {
    name: 'auth0',
    enabled: true,
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_AUTH0_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_AUTH0_CLIENT_SECRET',
      'NUXT_OIDC_PROVIDERS_AUTH0_BASE_URL',
    ],
    offlineCapable: false,
    config: {},
  },
  cognito: {
    name: 'cognito',
    enabled: true,
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_COGNITO_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_COGNITO_CLIENT_SECRET',
      'NUXT_OIDC_PROVIDERS_COGNITO_BASE_URL',
    ],
    offlineCapable: false,
    config: {},
  },
  entra: {
    name: 'entra',
    enabled: true,
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_ENTRA_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_ENTRA_CLIENT_SECRET',
      'NUXT_OIDC_PROVIDERS_ENTRA_TENANT_ID',
    ],
    offlineCapable: false,
    config: {},
  },
  github: {
    name: 'github',
    enabled: true,
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_GITHUB_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_GITHUB_CLIENT_SECRET',
    ],
    offlineCapable: false,
    config: {},
  },
  keycloak: {
    name: 'keycloak',
    enabled: false, // Disabled by default - requires running server
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_SECRET',
      'NUXT_OIDC_PROVIDERS_KEYCLOAK_BASE_URL',
    ],
    offlineCapable: false,
    config: {},
  },
  logto: {
    name: 'logto',
    enabled: true,
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_LOGTO_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_LOGTO_CLIENT_SECRET',
      'NUXT_OIDC_PROVIDERS_LOGTO_BASE_URL',
    ],
    offlineCapable: false,
    config: {},
  },
  microsoft: {
    name: 'microsoft',
    enabled: true,
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_MICROSOFT_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_MICROSOFT_CLIENT_SECRET',
    ],
    offlineCapable: false,
    config: {},
  },
  paypal: {
    name: 'paypal',
    enabled: true,
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_PAYPAL_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_PAYPAL_CLIENT_SECRET',
    ],
    offlineCapable: false,
    config: {},
  },
  zitadel: {
    name: 'zitadel',
    enabled: true,
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_ZITADEL_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_ZITADEL_BASE_URL',
    ],
    offlineCapable: false,
    config: {},
  },
}

/**
 * Validates environment configuration for a specific provider
 */
export function validateProviderEnv(providerName: string): EnvValidationResult {
  const config = providerConfigs[providerName]

  if (!config) {
    return {
      provider: providerName,
      configured: false,
      missingVars: [],
      presentVars: [],
    }
  }

  // Check for Keycloak enable flag
  if (providerName === 'keycloak') {
    const enableFlag = process.env.NUXT_OIDC_TEST_ENABLE_KEYCLOAK
    if (enableFlag !== 'true') {
      return {
        provider: providerName,
        configured: false,
        missingVars: ['NUXT_OIDC_TEST_ENABLE_KEYCLOAK=true'],
        presentVars: [],
      }
    }
  }

  const missingVars: string[] = []
  const presentVars: string[] = []

  for (const envVar of config.requiredEnvVars) {
    if (process.env[envVar]) {
      presentVars.push(envVar)
    }
    else {
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

/**
 * Validates all provider configurations and returns a summary
 */
export function validateAllProviders(): EnvValidationResult[] {
  return Object.keys(providerConfigs).map(provider => validateProviderEnv(provider))
}

/**
 * Check if a provider is configured for testing.
 * Use this in test files to skip tests when provider is not configured.
 *
 * @example
 * ```typescript
 * import { skipUnlessConfigured } from '../setup/env-validator'
 *
 * // At the top of your test file:
 * skipUnlessConfigured('auth0')
 *
 * test.describe('Auth0 Provider', () => {
 *   // Tests here will only run if Auth0 is configured
 * })
 * ```
 */
export function skipUnlessConfigured(providerName: string): void {
  const result = validateProviderEnv(providerName)

  if (!result.configured) {
    const config = providerConfigs[providerName]

    if (config?.offlineCapable) {
      // Offline-capable providers (like generic OIDC) don't need env vars
      return
    }

    // For Playwright tests, we use test.skip() which is imported in the test file
    // This function just logs the warning; actual skipping happens in test files
    console.warn(`\n⚠️  Skipping ${providerName} tests - not configured`)
    if (result.missingVars.length > 0) {
      console.warn(`   Missing: ${result.missingVars.join(', ')}`)
    }
  }
}

/**
 * Check if provider is configured (returns boolean for conditional logic)
 */
export function isProviderConfigured(providerName: string): boolean {
  const config = providerConfigs[providerName]

  // Offline-capable providers are always "configured"
  if (config?.offlineCapable) {
    return true
  }

  const result = validateProviderEnv(providerName)
  return result.configured
}

/**
 * Print configuration status for all providers (used by test:check-env script)
 */
export function printConfigurationStatus(): void {
  console.log('\n📋 Provider Configuration Status:\n')

  const results = validateAllProviders()

  for (const result of results) {
    const config = providerConfigs[result.provider]
    const status = result.configured ? '✓' : '✗'
    const statusColor = result.configured ? '\x1B[32m' : '\x1B[31m'
    const resetColor = '\x1B[0m'

    let statusText = result.configured ? 'configured' : 'not configured'

    if (config?.offlineCapable) {
      statusText = 'offline (mock provider)'
    }
    else if (!config?.enabled) {
      statusText = 'disabled (requires server)'
    }
    else if (result.missingVars.length > 0) {
      statusText = `missing: ${result.missingVars.map((v: string) => v.replace('NUXT_OIDC_PROVIDERS_', '').replace(/_/g, ' ')).join(', ')}`
    }

    console.log(`${statusColor}${status}${resetColor} ${result.provider.padEnd(12)} - ${statusText}`)
  }

  console.log('')
}

// CLI mode: run with --check flag to print status
if (process.argv.includes('--check')) {
  printConfigurationStatus()
}
