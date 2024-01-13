import { defineNuxtModule, addPlugin, createResolver, addImportsDir, addServerHandler, useLogger, extendRouteRules, addRouteMiddleware } from '@nuxt/kit'
import { defu } from 'defu'
import { subtle } from 'uncrypto'
import { genBase64FromBytes, generateRandomUrlSafeString } from './runtime/server/utils/security'
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
}

declare module '@nuxt/schema' {
  interface RuntimeConfig {
    oidc: ModuleOptions
  }
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'oidc-auth',
    configKey: 'oidc',
    compatibility: {
      nuxt: '^3.9.0'
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
  },
  async setup(options, nuxt) {
    const logger = useLogger('oidc-auth')
    const { resolve } = createResolver(import.meta.url)

    if (!options.enabled) { return }

    // TODO: Find a better place to do the optional init to make setup sync again
    if (!nuxt.options._prepare) {
      if (!process.env.NUXT_OIDC_SESSION_SECRET || process.env.NUXT_OIDC_SESSION_SECRET.length < 48) {
        const randomSecret = generateRandomUrlSafeString()
        process.env.NUXT_OIDC_SESSION_SECRET = randomSecret
        logger.warn('No session secret set, using a random secret. Please set NUXT_OIDC_SESSION_SECRET in your .env file with at least 48 chars.')
        logger.info(`NUXT_OIDC_SESSION_SECRET=${randomSecret}`)
      }
      if (!process.env.NUXT_OIDC_TOKEN_KEY) {
        const randomKey = genBase64FromBytes(new Uint8Array(await subtle.exportKey('raw', await subtle.generateKey({ name: 'AES-GCM', length: 256, }, true, ['encrypt', 'decrypt']))))
        process.env.NUXT_OIDC_TOKEN_KEY = randomKey
        logger.warn('No refresh token key set, using a random key. Please set NUXT_OIDC_TOKEN_KEY in your .env file. Refresh tokens saved in this session will be inaccessible after a server restart.')
        logger.info(`NUXT_OIDC_TOKEN_KEY=${randomKey}`)
      }
      if (!process.env.NUXT_OIDC_AUTH_SESSION_SECRET) {
        const randomKey = generateRandomUrlSafeString()
        process.env.NUXT_OIDC_AUTH_SESSION_SECRET = randomKey
        logger.warn('No auth session secret set, using a random secret. Please set NUXT_OIDC_AUTH_SESSION_SECRET in your .env file.')
        logger.info(`NUXT_OIDC_AUTH_SESSION_SECRET=${randomKey}`)
      }
    }

    // App
    addImportsDir(resolve('./runtime/composables'))
    addPlugin(resolve('./runtime/plugins/session.server'))

    // Server
    if (nuxt.options.nitro.imports !== false) {
      // TODO: address https://github.com/Atinux/nuxt-auth-utils/issues/1 upstream in unimport
      nuxt.options.nitro.imports = defu(nuxt.options.nitro.imports, {
        presets: [
          {
            from: resolve('./runtime/server/utils/session'),
            imports: [
              'sessionHooks',
            ]
          }
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
        name: 'auth',
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
