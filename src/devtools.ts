import type { Resolver } from '@nuxt/kit'
import type { Nuxt } from 'nuxt/schema'
import { existsSync } from 'node:fs'
import { extendServerRpc, onDevToolsInitialized } from '@nuxt/devtools-kit'

const DEVTOOLS_UI_ROUTE = '/__nuxt-oidc-auth'
const DEVTOOLS_UI_LOCAL_PORT = 3300
const RPC_NAMESPACE = 'nuxt-oidc-auth-rpc'

interface ServerFunctions {
  getNuxtOidcAuthSecrets: () => Record<'tokenKey' | 'sessionSecret' | 'authSessionSecret', string>
}

type ClientFunctions = Record<string, never>

export function setupDevToolsUI(nuxt: Nuxt, resolver: Resolver) {
  const clientPath = resolver.resolve('./client')
  const isProductionBuild = existsSync(clientPath)

  // Serve production-built client (used when package is published)
  if (isProductionBuild) {
    nuxt.hook('vite:serverCreated', async (server) => {
      const sirv = await import('sirv').then(r => r.default || r)
      server.middlewares.use(
        DEVTOOLS_UI_ROUTE,
        sirv(clientPath, { dev: true, single: true }),
      )
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
      getNuxtOidcAuthSecrets() {
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
