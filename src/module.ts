import type { OidcProviderConfig } from '@redocly/config'
import type { AuthSessionConfig, DevModeConfig, MiddlewareConfig, ProviderConfigs, ProviderKeys } from './runtime/types'
import {
  addImportsDir,
  addPlugin,
  addRouteMiddleware,
  addServerHandler,
  addServerPlugin,
  createResolver,
  defineNuxtModule,
  extendRouteRules,
  useLogger,
} from '@nuxt/kit'
import { defu } from 'defu'
import { setupDevToolsUI } from './devtools'
import * as providerPresets from './runtime/providers'
import { replaceInjectedParameters } from './runtime/server/utils/config'

const { resolve } = createResolver(import.meta.url)

declare module '@nuxt/schema' {
  interface RuntimeConfig {
    oidc: ModuleOptions
  }
}

const DEFAULTS: ModuleOptions = {
  enabled: true,
  session: {
    automaticRefresh: true,
    expirationCheck: true,
    maxAge: 60 * 60 * 24, // 1 day
    maxAuthSessionAge: 300, // 5 minutes
    cookie: {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },
  providers: {} as ProviderConfigs,
  middleware: {
    globalMiddlewareEnabled: true,
    customLoginPage: false,
    customLogoutPage: false,
  },
  provideDefaultSecrets: true,
  devtools: true,
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-oidc-auth',
    configKey: 'oidc',
    compatibility: {
      nuxt: '>=3.9.0',
      bridge: false,
    },
  },
  defaults: DEFAULTS,
  setup(options, nuxt) {
    const logger = useLogger('nuxt-oidc-auth')
    if (!options.enabled)
      return

    // Types
    nuxt.options.alias['#oidc-auth'] = resolve('./types')

    // App
    addImportsDir(resolve('./runtime/composables'))
    addPlugin(resolve('./runtime/plugins/session.client'))

    // Server (nitro) plugins
    addServerPlugin(resolve('./runtime/plugins/oidcInit'))
    addPlugin(resolve('./runtime/plugins/session.server'))
    if (options.provideDefaultSecrets) {
      addServerPlugin(resolve('./runtime/plugins/provideDefaults'))
    }

    // Server imports
    if (nuxt.options.nitro.imports !== false) {
      nuxt.options.nitro.imports = defu(nuxt.options.nitro.imports, {
        presets: [
          {
            from: resolve('./runtime/server/utils/session'),
            imports: [
              'sessionHooks',
            ],
          },
        ],
      })
    }

    // Add server handlers for session management
    addServerHandler({
      handler: resolve('./runtime/server/api/session.delete'),
      route: '/api/_auth/session',
      method: 'delete',
    })

    addServerHandler({
      handler: resolve('./runtime/server/api/session.get'),
      route: '/api/_auth/session',
      method: 'get',
    })

    addServerHandler({
      handler: resolve('./runtime/server/api/refresh.post'),
      route: '/api/_auth/refresh',
      method: 'post',
    })

    const providers = Object.keys(options.providers) as ProviderKeys[]
    // Automatically set default provider
    if (!options.defaultProvider && providers.length === 1) {
      options.defaultProvider = providers[0]
    }

    // Add default provider routes
    if (process.env.NODE_ENV && !process.env.NODE_ENV.toLowerCase().startsWith('prod') && options.devMode?.enabled) {
      extendRouteRules('/auth/login', {
        redirect: {
          to: '/auth/dev/login',
          statusCode: 302,
        },
      })
      extendRouteRules('/auth/logout', {
        redirect: {
          to: `/auth/dev/logout`,
          statusCode: 302,
        },
      })
    }
    else {
      if (options.defaultProvider) {
        if (!options.middleware.customLoginPage) {
          extendRouteRules('/auth/login', {
            redirect: {
              to: `/auth/${options.defaultProvider}/login`,
              statusCode: 302,
            },
          })
        }
        if (!options.middleware.customLogoutPage) {
          extendRouteRules('/auth/logout', {
            redirect: {
              to: `/auth/${options.defaultProvider}/logout`,
              statusCode: 302,
            },
          })
        }
      }
    }

    // Dev mode handler
    if (process.env.NODE_ENV && !process.env.NODE_ENV.toLowerCase().startsWith('prod') && options.devMode?.enabled) {
      addServerHandler({
        handler: resolve('./runtime/server/handler/dev'),
        route: '/auth/dev/login',
        method: 'get',
      })
      addServerHandler({
        handler: resolve('./runtime/server/handler/logout.get'),
        route: '/auth/dev/logout',
        method: 'get',
      })
    }

    // Add login handler
    addServerHandler({
      handler: resolve('./runtime/server/handler/login.get'),
      route: `/auth/:provider/login`,
      method: 'get',
    })
    // Add callback handler
    addServerHandler({
      handler: resolve('./runtime/server/handler/callback'),
      route: `/auth/:provider/callback`,
      method: 'get',
    })
    // Add callback handler for hybrid flows
    addServerHandler({
      handler: resolve('./runtime/server/handler/callback'),
      route: `/auth/:provider/callback`,
      method: 'post',
    })
    // Add logout handler
    addServerHandler({
      handler: resolve('./runtime/server/handler/logout.get'),
      route: `/auth/:provider/logout`,
      method: 'get',
    })

    if (!nuxt.options._prepare)
      logger.success(`Registered ${providers.length} OIDC providers: ${providers.join(', ')}`)

    // Add global auth middleware
    if (options.middleware.globalMiddlewareEnabled) {
      addRouteMiddleware({
        name: '00.auth.global',
        path: resolve('runtime/middleware/oidcAuth'),
        global: true,
      })
    }

    providers.forEach((provider) => {
      // Replace placeholder parameters from provider presets
      replaceInjectedParameters(['clientId'], options.providers[provider] as OidcProviderConfig, providerPresets[provider], provider)
    })

    // Add single sign out middleware
    if (providers.some(provider => options.providers[provider]?.sessionConfiguration?.singleSignOut)) {
      addPlugin(resolve('./runtime/plugins/sso.client'))
      addServerHandler({
        handler: resolve('./runtime/server/api/sso'),
        route: '/api/_auth/sso',
        method: 'get',
      })
    }

    if (options.devtools)
      setupDevToolsUI(nuxt, createResolver(import.meta.url))

    // Runtime Config
    nuxt.options.runtimeConfig.oidc = defu(
      nuxt.options.runtimeConfig.oidc,
      {
        ...options,
      },
    )
  },
})

export interface ModuleOptions {
  /**
   * Enable module
   */
  enabled: boolean
  /**
   * Enable Nuxt devtools integration
   * @default true
   */
  devtools?: boolean
  /**
   * Default provider. Will be used with composable if no provider is specified
   */
  defaultProvider?: ProviderKeys
  /**
   * OIDC providers
   */
  providers: Partial<ProviderConfigs>
  /**
   * Optional session configuration.
   */
  session: Omit<AuthSessionConfig, 'singleSignOutIdField' | 'singleSignOut'>
  /**
   * Middleware configuration
   */
  middleware: MiddlewareConfig
  /**
   * Dev mode configuration
   */
  devMode?: DevModeConfig
  /**
   * Provide defaults for NUXT_OIDC_SESSION_SECRET, NUXT_OIDC_TOKEN_KEY and NUXT_OIDC_AUTH_SESSION_SECRET using a Nitro plugin. Turning this off can lead to the app not working if no secrets are provided.
   * @default true
   */
  provideDefaultSecrets?: boolean
}
