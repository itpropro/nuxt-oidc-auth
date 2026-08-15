import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from 'nuxt/schema'
import { existsSync } from 'node:fs'
import { extendServerRpc, onDevToolsInitialized } from '@nuxt/devtools-kit'
import * as providerPresets from './runtime/providers'
import { resolveProviderConfig } from './runtime/server/utils/config'

const DEVTOOLS_UI_ROUTE = '/__nuxt-oidc-auth'
const DEVTOOLS_UI_LOCAL_PORT = 3300
const RPC_NAMESPACE = 'nuxt-oidc-auth-rpc'

interface ServerFunctions {
  getNuxtOidcAuthConfig: (token: string) => Promise<DevtoolsOidcConfig>
  getNuxtOidcAuthSecrets: (
    token: string,
  ) => Promise<Record<'tokenKey' | 'sessionSecret' | 'authSessionSecret', string>>
}

type ClientFunctions = Record<string, never>
type DevtoolsOidcConfig = {
  providers: Record<string, unknown>
  devMode: Record<string, unknown>
}
type DevtoolsAuthContext = {
  ensureDevAuthToken: (token: string) => Promise<void>
}

type DevtoolsTab = {
  name: string
  title: string
  icon: string
  view: {
    type: 'iframe'
    src: string
  }
}

const REDACTED_VALUE = '[redacted]'
const SENSITIVE_CONFIG_KEYS = new Set([
  'accessToken',
  'access_token',
  'authSessionSecret',
  'clientSecret',
  'client_secret',
  'idToken',
  'id_token',
  'password',
  'privateKey',
  'private_key',
  'proxy',
  'refreshToken',
  'refresh_token',
  'sessionSecret',
  'tokenKey',
])

function sanitizeConfig(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_CONFIG_KEYS.has(key)) {
    return value === undefined || value === '' ? value : REDACTED_VALUE
  }
  if (typeof value === 'function') return '[function]'
  if (Array.isArray(value)) return value.map((item) => sanitizeConfig(item))
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).map(([nestedKey, nestedValue]) => [
      nestedKey,
      sanitizeConfig(nestedValue, nestedKey),
    ]),
  )
}

function isProviderKey(value: string): value is keyof typeof providerPresets {
  return Object.hasOwn(providerPresets, value)
}

function getDevtoolsOidcConfig(nuxt: Nuxt): DevtoolsOidcConfig {
  const oidc = nuxt.options.runtimeConfig.oidc as
    | {
        providers?: Record<string, Record<string, unknown>>
        devMode?: Record<string, unknown>
      }
    | undefined
  const providers = Object.fromEntries(
    Object.entries(oidc?.providers || {}).flatMap(([provider, runtimeConfig]) => {
      if (!isProviderKey(provider)) return []
      return [
        [provider, sanitizeConfig(resolveProviderConfig(runtimeConfig, providerPresets[provider]))],
      ]
    }),
  )

  return {
    providers,
    devMode: sanitizeConfig(oidc?.devMode || {}) as Record<string, unknown>,
  }
}

async function ensureDevtoolsAuth(nuxt: Nuxt, token: string): Promise<void> {
  const devtools = (nuxt as Nuxt & { devtools?: DevtoolsAuthContext }).devtools
  if (!devtools) {
    throw new Error('[nuxt-oidc-auth] Nuxt DevTools context is unavailable.')
  }

  await devtools.ensureDevAuthToken(token)
}

export function setupDevToolsUI(nuxt: Nuxt, resolver: Resolver) {
  const clientPath = resolver.resolve('./client')
  const isProductionBuild = existsSync(clientPath)

  // Serve production-built client (used when package is published)
  if (isProductionBuild) {
    nuxt.hook('vite:serverCreated', async (server) => {
      const sirv = await import('sirv').then((r) => r.default || r)
      server.middlewares.use(DEVTOOLS_UI_ROUTE, sirv(clientPath, { dev: true, single: true }))
    })
  }
  // In local development, start a separate Nuxt Server and proxy to serve the client
  else {
    nuxt.hook('vite:extendConfig', (config) => {
      const server = {
        ...(config.server || {}),
        proxy: {
          ...(config.server?.proxy || {}),
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
  onDevToolsInitialized(async () => {
    extendServerRpc<ClientFunctions, ServerFunctions>(RPC_NAMESPACE, {
      async getNuxtOidcAuthConfig(token) {
        await ensureDevtoolsAuth(nuxt, token)
        return getDevtoolsOidcConfig(nuxt)
      },
      async getNuxtOidcAuthSecrets(token) {
        await ensureDevtoolsAuth(nuxt, token)

        const tokenKey = process.env.NUXT_OIDC_TOKEN_KEY || ''
        const sessionSecret = process.env.NUXT_OIDC_SESSION_SECRET || ''
        const authSessionSecret = process.env.NUXT_OIDC_AUTH_SESSION_SECRET || ''
        return {
          tokenKey,
          sessionSecret,
          authSessionSecret,
        }
      },
    })
  })

  ;(nuxt.hook as (name: string, fn: (tabs: DevtoolsTab[]) => void) => void)(
    'devtools:customTabs',
    (tabs) => {
      tabs.push({
        name: 'nuxt-oidc-auth',
        title: 'Nuxt OIDC Auth',
        icon: 'carbon:rule-locked',
        view: {
          type: 'iframe',
          src: DEVTOOLS_UI_ROUTE,
        },
      })
    },
  )
}
