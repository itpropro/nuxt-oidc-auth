import { defineNuxtModule, addPlugin, createResolver, addImportsDir, addServerHandler } from '@nuxt/kit'
import { sha256 } from 'ohash'
import { defu } from 'defu'
import { defaultConfig } from './defaultConfig'
import * as providerConfigs from './providers'
import type { ModuleOptions, Providers } from './types'
import { withoutTrailingSlash, cleanDoubleSlashes, withHttps, joinURL } from 'ufo'

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
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    nuxt.options.alias['#oidc-auth'] = resolver.resolve('./types/index')

    if (!options.enabled) { return }

    if (!process.env.NUXT_SESSION_PASSWORD && !nuxt.options._prepare) {
      const randomPassword = sha256(`${Date.now()}${Math.random()}`).slice(0, 32)
      process.env.NUXT_SESSION_PASSWORD = randomPassword
      console.warn('No session password set, using a random password, please set NUXT_SESSION_PASSWORD in your .env file with at least 32 chars')
      console.log(`NUXT_SESSION_PASSWORD=${randomPassword}`)
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

    // Per provider tasks
    Object.keys(options.providers).forEach((provider) => {
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
