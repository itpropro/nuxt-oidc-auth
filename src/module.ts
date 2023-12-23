import { defineNuxtModule, addPlugin, createResolver, addImportsDir, addServerHandler, useLogger, extendRouteRules } from '@nuxt/kit'
import { defu } from 'defu'
import { defaultConfig } from './defaultConfig'
import * as providerConfigs from './providers'
import type { ModuleOptions, Providers } from './types'
import { withoutTrailingSlash, cleanDoubleSlashes, withHttps, joinURL } from 'ufo'
import { subtle } from 'uncrypto'
import { genBase64FromBytes, generateRandomUrlSafeString } from './runtime/server/utils/security'

declare module 'nuxt/schema' {
  interface NuxtOptions {
    oidc?: ModuleOptions
  }
  interface RuntimeConfig {
    oidc: ModuleOptions,
    private: {}
  }
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'oidc-auth',
    configKey: 'oidc',
  },
  defaults: defaultConfig,
  async setup(options, nuxt) {
    const logger = useLogger('oidc-auth')
    const resolver = createResolver(import.meta.url)

    nuxt.options.alias['#oidc-auth'] = resolver.resolve('./types/index')

    if (!options.enabled) { return }

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
    addImportsDir(resolver.resolve('./runtime/composables'))
    addPlugin(resolver.resolve('./runtime/plugins/session.server'))

    // Server
    if (nuxt.options.nitro.imports !== false) {
      // TODO: address https://github.com/Atinux/nuxt-auth-utils/issues/1 upstream in unimport
      nuxt.options.nitro.imports = defu(nuxt.options.nitro.imports, {
        presets: [
          {
            from: resolver.resolve('./runtime/server/lib/oidc'),
            imports: ['oidc']
          },
          {
            from: resolver.resolve('./runtime/server/utils/session'),
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
    // addServerImportsDir(resolver.resolve('./runtime/server/utils'))
    addServerHandler({
      handler: resolver.resolve('./runtime/server/api/session.delete'),
      route: '/api/_auth/session',
      method: 'delete'
    })

    addServerHandler({
      handler: resolver.resolve('./runtime/server/api/session.get'),
      route: '/api/_auth/session',
      method: 'get'
    })

    addServerHandler({
      handler: resolver.resolve('./runtime/server/api/refresh.post'),
      route: '/api/_auth/refresh',
      method: 'post'
    })

    // Add default provider routes
    if (options.defaultProvider) {
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
      if (options.providers[provider as Providers].baseUrl) {
        defaultConfig.providers[provider as Providers] = {} as any
        defaultConfig.providers[provider as Providers].authorizationUrl = withoutTrailingSlash(cleanDoubleSlashes(withHttps(joinURL(options.providers[provider as Providers].baseUrl as string, `/${providerConfigs[provider as Providers].authorizationUrl}`))))
        defaultConfig.providers[provider as Providers].tokenUrl = withoutTrailingSlash(cleanDoubleSlashes(withHttps(joinURL(options.providers[provider as Providers].baseUrl as string, `/${providerConfigs[provider as Providers].tokenUrl}`))))
        defaultConfig.providers[provider as Providers].userinfoUrl = withoutTrailingSlash(cleanDoubleSlashes(withHttps(joinURL(options.providers[provider as Providers].baseUrl as string, `/${providerConfigs[provider as Providers].userinfoUrl}`))))
      }
      // Validate config

      // Add login handler
      addServerHandler({
        handler: resolver.resolve('./runtime/server/handler/login.get'),
        route: `/auth/${provider}/login`,
        method: 'get'
      })
      // Add callback handler N4A86YL35HV2TPU99ARKMR41
      addServerHandler({
        handler: resolver.resolve('./runtime/server/handler/callback'),
        route: `/auth/${provider}/callback`,
        method: 'get'
      })
      // Add callback handler for hybrid flows
      addServerHandler({
        handler: resolver.resolve('./runtime/server/handler/callback'),
        route: `/auth/${provider}/callback`,
        method: 'post'
      })
      // Add logout handler
      addServerHandler({
        handler: resolver.resolve('./runtime/server/handler/logout.get'),
        route: `/auth/${provider}/logout`,
        method: 'get'
      })
    })
    logger.success(`Registered ${providers.length} OIDC providers: ${providers.join(', ')}`)

    const oidcOptions = defu(options, defaultConfig)

    // Runtime Config
    nuxt.options.runtimeConfig.oidc = defu(
      nuxt.options.runtimeConfig.oidc,
      {
        ...oidcOptions
      }
    )
  }
})
