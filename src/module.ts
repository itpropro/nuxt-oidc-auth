import { defineNuxtModule, addPlugin, createResolver, addImportsDir, addServerHandler, useLogger, extendRouteRules, addRouteMiddleware } from '@nuxt/kit'
import { defu } from 'defu'
import { fileURLToPath } from 'node:url'
import * as providerConfigs from './runtime/providers'
import type { ModuleOptions, ProviderConfigs, Providers } from './runtime/types'
import { withoutTrailingSlash, cleanDoubleSlashes, withHttps, joinURL } from 'ufo'
import { subtle } from 'uncrypto'
import { genBase64FromBytes, generateRandomUrlSafeString } from './runtime/server/utils/security'

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'oidc-auth',
    configKey: 'oidc',
    compatibility: {
      nuxt: '^3.0.0'
    }
  },
  defaults: {
    enabled: true,
    session: {
      name: 'auth-session',
      automaticRefresh: false,
      cookie: {
        sameSite: 'lax',
        maxAge: 60 * 15
      },
    },
    providers: {} as ProviderConfigs,
    middleware: {
      globalMiddlewareEnabled: false,
      customLoginPage: false,
    },
  },
  async setup(options, nuxt) {
    const logger = useLogger('oidc-auth')
    const { resolve } = createResolver(import.meta.url)

    // Transpile runtime
    // const runtimeDir = resolve('./runtime')
    const runtimeDir = fileURLToPath(new URL('./runtime', import.meta.url))
    nuxt.options.build.transpile.push(runtimeDir, 'nuxt-oidc-auth')

    nuxt.options.alias['#oidc-auth'] = resolve('./types/index')

    if (!options.enabled) { return }

    // TODO: Find a better place to do the optional init to make setup sync again
    if (!nuxt.options._prepare) {
      if (!process.env.NUXT_OIDC_SESSION_SECRET || process.env.NUXT_OIDC_SESSION_SECRET.length <= 48) {
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
            from: resolve('./runtime/server/lib/oidc'),
            imports: ['oidc']
          },
          {
            from: resolve('./runtime/server/utils/session'),
            imports: [
              'sessionHooks',
              'getUserSession',
              'setUserSession',
              'clearUserSession',
              'requireUserSession',
            ]
          }
        ]
      })
    }

    // Waiting for https://github.com/nuxt/nuxt/pull/24000/files
    // addServerImportsDir(resolve('./runtime/server/utils'))
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
    const providers = Object.keys(options.providers)
    providers.forEach((provider) => {
      // Generate provider routes
      if ((options.providers as ProviderConfigs)[provider as Providers].baseUrl) {
        options.providers[provider as Providers] = {} as any
        // @ts-ignore
        options.providers[provider as Providers].authorizationUrl = withoutTrailingSlash(cleanDoubleSlashes(withHttps(joinURL((options.providers)[provider].baseUrl as string, `/${providerConfigs[provider].authorizationUrl}`))))
        // @ts-ignore
        options.providers[provider as Providers].tokenUrl = withoutTrailingSlash(cleanDoubleSlashes(withHttps(joinURL((options.providers)[provider].baseUrl as string, `/${providerConfigs[provider].tokenUrl}`))))
        // @ts-ignore
        options.providers[provider as Providers].userinfoUrl = withoutTrailingSlash(cleanDoubleSlashes(withHttps(joinURL((options.providers)[provider].baseUrl as string, `/${providerConfigs[provider].userinfoUrl}`))))
      }
      // Validate config

      // Add login handler
      addServerHandler({
        handler: resolve('./runtime/server/handler/login.get'),
        route: `/auth/${provider}/login`,
        method: 'get'
      })
      // Add callback handler N4A86YL35HV2TPU99ARKMR41
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
    logger.success(`Registered ${providers.length} OIDC providers: ${providers.join(', ')}`)

    // Add global auth middleware
    if (options.middleware.globalMiddlewareEnabled) {
      addRouteMiddleware({
        name: 'auth',
        path: resolve('runtime/middleware/oidcAuth.ts'),
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
