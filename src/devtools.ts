import { existsSync } from 'node:fs'

import { extendServerRpc, onDevToolsInitialized } from '@nuxt/devtools-kit'
import type { NuxtDevtoolsServerContext } from '@nuxt/devtools-kit/types'
import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from 'nuxt/schema'

import type { ModuleOptions } from './module'
import * as providerExports from './runtime/providers'
import { resolveProviderConfig } from './runtime/server/utils/config'
import type { OidcProviderConfig } from './runtime/server/utils/provider'

const DEVTOOLS_UI_ROUTE = '/__nuxt-oidc-auth'
const DEVTOOLS_UI_LOCAL_PORT = 3300
const RPC_NAMESPACE = 'nuxt-oidc-auth-rpc'
const providerPresets = { ...providerExports }

interface ServerFunctions {
  getNuxtOidcAuthConfig: (token: string) => Promise<DevtoolsOidcConfig>
  getNuxtOidcAuthSecrets: (
    token: string,
  ) => Promise<Record<'tokenKey' | 'sessionSecret' | 'authSessionSecret', string>>
}

type ClientFunctions = Record<string, never>
interface DevtoolsOidcConfig {
  providers: ModuleOptions['providers']
  devMode: NonNullable<ModuleOptions['devMode']>
}

const REDACTED_VALUE = '[redacted]'
const NON_SENSITIVE_TOKEN_CONFIG_KEYS = new Set([
  'exposeaccesstoken',
  'exposeidtoken',
  'skipaccesstokenparsing',
  'validateaccesstoken',
  'validateidtoken',
])
const SENSITIVE_CONFIG_KEYS = new Set(['apikey', 'proxy', 'token', 'tokenkey'])

function normalizeConfigKey(key: string): string {
  return key.replaceAll(/[^a-z0-9]/giu, '').toLowerCase()
}

function isSensitiveConfigKey(key: string): boolean {
  const normalizedKey = normalizeConfigKey(key)
  if (NON_SENSITIVE_TOKEN_CONFIG_KEYS.has(normalizedKey)) {
    return false
  }
  return (
    SENSITIVE_CONFIG_KEYS.has(normalizedKey) ||
    normalizedKey.includes('accesstoken') ||
    normalizedKey.includes('apikey') ||
    normalizedKey.includes('assertion') ||
    normalizedKey.includes('credential') ||
    normalizedKey.includes('idtoken') ||
    normalizedKey.includes('password') ||
    normalizedKey.includes('privatekey') ||
    normalizedKey.includes('refreshtoken') ||
    normalizedKey.includes('secret') ||
    normalizedKey.endsWith('token')
  )
}

function sanitizeConfigValue(value: unknown, key?: string, redactValue = false): unknown {
  if (
    (redactValue || (key !== undefined && isSensitiveConfigKey(key))) &&
    value !== undefined &&
    value !== ''
  ) {
    return REDACTED_VALUE
  }
  if (typeof value === 'function') {
    return '[function]'
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeConfigValue(item, undefined, redactValue))
  }
  if (value === null || typeof value !== 'object') {
    return value
  }

  const redactNestedValues =
    redactValue || normalizeConfigKey(key ?? '') === 'additionaltokenparameters'
  return Object.fromEntries(
    Object.entries(value).map(([nestedKey, nestedValue]) => [
      nestedKey,
      sanitizeConfigValue(nestedValue, nestedKey, redactNestedValues),
    ]),
  )
}

function sanitizeConfig<T extends OidcProviderConfig | NonNullable<ModuleOptions['devMode']>>(
  value: T,
): T {
  const sanitized = { ...value }
  // The owner schemas use strings for credentials and allow opaque values in nested metadata.
  for (const [key, nestedValue] of Object.entries(value)) {
    Reflect.set(sanitized, key, sanitizeConfigValue(nestedValue, key))
  }
  return sanitized
}

function isProviderKey(value: string): value is keyof typeof providerPresets {
  return Object.hasOwn(providerPresets, value)
}

function getDevtoolsOidcConfig(nuxt: Nuxt): DevtoolsOidcConfig {
  const moduleRuntimeConfig: { oidc?: Partial<ModuleOptions> } = nuxt.options.runtimeConfig
  const oidc = moduleRuntimeConfig.oidc
  const providers: ModuleOptions['providers'] = {}
  for (const [provider, runtimeConfig] of Object.entries(oidc?.providers ?? {})) {
    if (!isProviderKey(provider)) {
      continue
    }
    Reflect.set(
      providers,
      provider,
      sanitizeConfig(resolveProviderConfig(runtimeConfig, providerPresets[provider])),
    )
  }

  return {
    providers,
    devMode: sanitizeConfig(oidc?.devMode ?? {}),
  }
}

function isDevtoolsAuthContext(
  value: unknown,
): value is Pick<NuxtDevtoolsServerContext, 'ensureDevAuthToken'> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'ensureDevAuthToken' in value &&
    typeof value.ensureDevAuthToken === 'function'
  )
}

async function ensureDevtoolsAuth(nuxt: Nuxt, token: string): Promise<void> {
  const devtools = 'devtools' in nuxt ? nuxt.devtools : undefined
  if (!isDevtoolsAuthContext(devtools)) {
    throw new Error('[nuxt-oidc-auth] Nuxt DevTools context is unavailable.')
  }

  await devtools.ensureDevAuthToken(token)
}

export function setupDevToolsUI(nuxt: Nuxt, resolver: Resolver): void {
  const clientPath = resolver.resolve('./client')
  const isProductionBuild = existsSync(clientPath)

  // Serve production-built client (used when package is published)
  if (isProductionBuild) {
    nuxt.hook('vite:serverCreated', async (server) => {
      const { default: sirv } = await import('sirv')
      server.middlewares.use(DEVTOOLS_UI_ROUTE, sirv(clientPath, { dev: true, single: true }))
    })
  }
  // In local development, start a separate Nuxt Server and proxy to serve the client
  else {
    nuxt.hook('vite:extendConfig', (config) => {
      const server = {
        ...config.server,
        proxy: {
          ...config.server?.proxy,
          [DEVTOOLS_UI_ROUTE]: {
            target: `http://localhost:${DEVTOOLS_UI_LOCAL_PORT}${DEVTOOLS_UI_ROUTE}`,
            changeOrigin: true,
            followRedirects: true,
            rewrite: (path: string) => path.replace(DEVTOOLS_UI_ROUTE, ''),
          },
        },
      }

      Object.assign(config, { server })
    })
  }

  // Wait for DevTools to be initialized
  onDevToolsInitialized(() => {
    extendServerRpc<ClientFunctions, ServerFunctions>(RPC_NAMESPACE, {
      async getNuxtOidcAuthConfig(token) {
        await ensureDevtoolsAuth(nuxt, token)
        return getDevtoolsOidcConfig(nuxt)
      },
      async getNuxtOidcAuthSecrets(token) {
        await ensureDevtoolsAuth(nuxt, token)

        const tokenKey = process.env['NUXT_OIDC_TOKEN_KEY'] ?? ''
        const sessionSecret = process.env['NUXT_OIDC_SESSION_SECRET'] ?? ''
        const authSessionSecret = process.env['NUXT_OIDC_AUTH_SESSION_SECRET'] ?? ''
        return {
          tokenKey,
          sessionSecret,
          authSessionSecret,
        }
      },
    })
  })

  nuxt.hook('devtools:customTabs', (tabs) => {
    tabs.push({
      name: 'nuxt-oidc-auth',
      title: 'Nuxt OIDC Auth',
      icon: 'carbon:rule-locked',
      view: {
        type: 'iframe',
        src: DEVTOOLS_UI_ROUTE,
      },
    })
  })
}
