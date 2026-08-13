import type { TestProviderConfig } from '../setup/types'

export const providerConfigs = [
  {
    name: 'oidc',
    enabled: true,
    requiredEnvVars: [],
    offlineCapable: true,
    config: {},
  },
  {
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
  {
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
  {
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
  {
    name: 'github',
    enabled: true,
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_GITHUB_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_GITHUB_CLIENT_SECRET',
    ],
    offlineCapable: false,
    config: {},
  },
  {
    name: 'keycloak',
    enabled: true,
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_KEYCLOAK_CLIENT_SECRET',
      'NUXT_OIDC_PROVIDERS_KEYCLOAK_BASE_URL',
    ],
    offlineCapable: false,
    config: {},
  },
  {
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
  {
    name: 'microsoft',
    enabled: true,
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_MICROSOFT_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_MICROSOFT_CLIENT_SECRET',
    ],
    offlineCapable: false,
    config: {},
  },
  {
    name: 'paypal',
    enabled: true,
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_PAYPAL_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_PAYPAL_CLIENT_SECRET',
    ],
    offlineCapable: false,
    config: {},
  },
  {
    name: 'zitadel',
    enabled: true,
    requiredEnvVars: [
      'NUXT_OIDC_PROVIDERS_ZITADEL_CLIENT_ID',
      'NUXT_OIDC_PROVIDERS_ZITADEL_BASE_URL',
    ],
    offlineCapable: false,
    config: {},
  },
] as const satisfies readonly TestProviderConfig[]

export const providers = providerConfigs.map(({ name }) => name)
