import { defineNuxtModule, addPlugin, createResolver, addImportsDir, addServerHandler, useLogger, extendRouteRules, addRouteMiddleware, addServerPlugin } from '@nuxt/kit'
import { defu } from 'defu'
import * as providerPresets from './runtime/providers'
import type { OidcProviderConfig, ProviderConfigs, ProviderKeys } from './runtime/types/oidc'
import type { AuthSessionConfig } from './runtime/types/session'
import { generateProviderUrl } from './runtime/server/utils/config'

export interface MiddlewareConfig {
  /**
   * Enables/disables the global middleware
   * @default true
   */
  globalMiddlewareEnabled?: boolean
  /**
   * Enables/disables automatic registration of '/auth/login' and '/auth/logout' route rules
   * @default false
   */
  customLoginPage?: boolean
}

export interface DevModeConfig {
  /**
   * Enables/disables the dev mode. Dev mode can only be enabled when the app runs in a dev environment.
   * @default false
   */
  enabled?: boolean
  /**
   * Sets the `userName` field on the user object
   * @default 'Nuxt OIDC Auth Dev'
   */
  userName?: string
  /**
   * Sets the `providerInfo` field on the user object
   */
  providerInfo?: Record<string, unknown>
  /**
   * Sets the key algorithm for signing the generated JWT token
   */
  tokenAlgorithm?: 'symmetric' | 'asymmetric'
  /**
   * Sets the `idToken` field on the user object
   */
  idToken?: string
  /**
   * Sets the `accessToken` field on the user object
   */
  accessToken?: string
  /**
   * Sets the claims field on the user object and generated JWT token if `generateAccessToken` is set to `true`.
   */
  claims?: Record<string, string>
  /**
   * If set generates a JWT token for the access_token field based on the given user information
   * @default false
  */
  generateAccessToken?: boolean
  /**
   * Only used with `generateAccessToken`. Sets the issuer field on the generated JWT token.
   * @default 'nuxt:oidc:auth:issuer
   */
  issuer?: string
  /**
   * Only used with `generateAccessToken`. Sets the audience field on the generated JWT token.
   * @default 'nuxt:oidc:auth:audience
   */
  audience?: string
  /**
   * Only used with `generateAccessToken`. Sets the subject field on the generated JWT token.
   * @default 'nuxt:oidc:auth:subject
   */
  subject?: string
}

export interface ModuleOptions {
  /**
   * Enable module
   */
  enabled: boolean
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
  session: AuthSessionConfig
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

declare module '@nuxt/schema' {
  interface RuntimeConfig {
    oidc: ModuleOptions
  }
}

const { resolve } = createResolver(import.meta.url)

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-oidc-auth',
    configKey: 'oidc',
    compatibility: {
      nuxt: '^3.9.0',
      bridge: false,
    }
  },
  defaults: {
    enabled: true,
    session: {
      automaticRefresh: true,
      expirationCheck: true,
      maxAge: 60 * 60 * 24, // 1 day
      cookie: {
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    providers: {} as ProviderConfigs,
    middleware: {
      globalMiddlewareEnabled: true,
      customLoginPage: false,
    },
    provideDefaultSecrets: true,
  },
  setup(options, nuxt) {
    const logger = useLogger('nuxt-oidc-auth')

    if (!options.enabled) { return }

    // App
    addImportsDir(resolve('./runtime/composables'))
    addPlugin(resolve('./runtime/plugins/session.server'))

    // Server (nitro) plugins
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
            ]
          },
        ]
      })
    }

    // Add server handlers for session management
    addServerHandler({
      handler: resolve('./runtime/server/api/session.delete'),
      route: '/api/_auth/session',
      method: 'delete'
    })

    addServerHandler({
      handler: resolve('./runtime/server/api/session.get'),
      route: '/api/_auth/session',
      method: 'get'
    })

    addServerHandler({
      handler: resolve('./runtime/server/api/refresh.post'),
      route: '/api/_auth/refresh',
      method: 'post'
    })

    const providers = Object.keys(options.providers) as ProviderKeys[]
    // Automatically set default provider
    if (!options.defaultProvider && providers.length === 1) {
      options.defaultProvider = providers[0]
    }

    // Add default provider routes
    if (process.env['NODE_ENV'] && process.env['NODE_ENV'] === 'development' && options.devMode?.enabled) {
      extendRouteRules('/auth/login', {
        redirect: {
          to: '/auth/dev/login',
          statusCode: 302
        }
      })
      extendRouteRules('/auth/logout', {
        redirect: {
          to: '/auth/dev/logout',
          statusCode: 302
        }
      })
    } else {
      if (options.defaultProvider && !options.middleware.customLoginPage) {
        extendRouteRules('/auth/login', {
          redirect: {
            to: `/auth/${options.defaultProvider}/login`,
            statusCode: 302
          }
        })
        extendRouteRules('/auth/logout', {
          redirect: {
            to: `/auth/${options.defaultProvider}/logout`,
            statusCode: 302
          }
        })
      }
    }

    // Dev mode handler
    if (process.env['NODE_ENV'] && process.env['NODE_ENV'] === 'development' && options.devMode?.enabled) {
      addServerHandler({
        handler: resolve('./runtime/server/handler/dev'),
        route: '/auth/dev/login',
        method: 'get',
      })
      addServerHandler({
        handler: resolve('./runtime/server/handler/logout.get'),
        route: '/auth/dev/logout',
        method: 'get'
      })
    }


    // Per provider tasks
    providers.forEach((provider) => {
      const baseUrl = process.env[`NUXT_OIDC_PROVIDERS_${provider.toUpperCase()}_BASE_URL`] || (options.providers as ProviderConfigs)[provider].baseUrl

      // Generate provider routes
      if (baseUrl) {
        (options.providers[provider] as OidcProviderConfig).authorizationUrl = generateProviderUrl(baseUrl as string, providerPresets[provider].authorizationUrl);
        (options.providers[provider] as OidcProviderConfig).tokenUrl = generateProviderUrl(baseUrl as string, providerPresets[provider].tokenUrl);
        (options.providers[provider] as OidcProviderConfig).userinfoUrl = generateProviderUrl(baseUrl as string, providerPresets[provider].userinfoUrl)
      }

      // Add login handler
      addServerHandler({
        handler: resolve('./runtime/server/handler/login.get'),
        route: `/auth/${provider}/login`,
        method: 'get'
      })
      // Add callback handler
      addServerHandler({
        handler: resolve('./runtime/server/handler/callback'),
        route: `/auth/${provider}/callback`,
        method: 'get'
      })
      // Add callback handler for hybrid flows
      addServerHandler({
        handler: resolve('./runtime/server/handler/callback'),
        route: `/auth/${provider}/callback`,
        method: 'post'
      })
      // Add logout handler
      addServerHandler({
        handler: resolve('./runtime/server/handler/logout.get'),
        route: `/auth/${provider}/logout`,
        method: 'get'
      })
    })

    !nuxt.options._prepare && logger.success(`Registered ${providers.length} OIDC providers: ${providers.join(', ')}`)

    // Add global auth middleware
    if (options.middleware.globalMiddlewareEnabled) {
      addRouteMiddleware({
        name: '00.auth',
        path: resolve('runtime/middleware/oidcAuth'),
        global: true
      })
    }

    // Runtime Config
    nuxt.options.runtimeConfig.oidc = defu(
      nuxt.options.runtimeConfig.oidc,
      {
        ...options
      }
    )
  }
})
