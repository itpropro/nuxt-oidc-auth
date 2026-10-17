import {
  addTypeTemplate,
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

import { isRuntimeDevModeEnabled, setupDevToolsUI } from './devtools'
import * as providerExports from './runtime/providers'
import { createProviderRuntimeConfig } from './runtime/server/utils/config'
import { provideDefaultSecrets } from './runtime/server/utils/default-secrets'
import type {
  AuthSessionConfig,
  DevModeConfig,
  MiddlewareConfig,
  ProviderKeys,
  ProviderRuntimeConfig,
} from './runtime/types'

// oxlint-disable-next-line typescript-eslint/unbound-method -- createResolver returns a standalone resolve function
const { resolve } = createResolver(import.meta.url)
const providerPresets = { ...providerExports }

const DEFAULTS: ModuleOptions = {
  enabled: true,
  session: {
    automaticRefresh: true,
    expirationCheck: true,
    missingPersistentSession: 'clear',
    // 1 day
    maxAge: 60 * 60 * 24,
    // 5 minutes
    maxAuthSessionAge: 300,
    cookie: {
      sameSite: 'lax',
      // secure is resolved at runtime in the session utils so it reflects the runtime environment
      // rather than a value frozen at build time.
    },
  },
  providers: {},
  middleware: {
    globalMiddlewareEnabled: true,
    redirect: true,
    customLoginPage: false,
    customLogoutPage: false,
  },
  provideDefaultSecrets: true,
  devtools: true,
}

function isProviderKey(value: string): value is ProviderKeys {
  return Object.hasOwn(providerPresets, value)
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-oidc-auth',
    configKey: 'oidc',
    compatibility: {
      nuxt: '>=3.9.0',
    },
  },
  defaults: DEFAULTS,
  async setup(options, nuxt) {
    const modulePath = JSON.stringify(resolve('./module'))
    const schemaTemplate = addTypeTemplate({
      filename: 'types/nuxt-oidc-auth-schema.d.ts',
      getContents: () => `import type { ModuleOptions, PublicModuleOptions } from ${modulePath}

declare module '@nuxt/schema' {
  interface NuxtConfig {
    oidc?: Partial<ModuleOptions>
  }

  interface RuntimeConfig {
    oidc: ModuleOptions
  }

  interface PublicRuntimeConfig {
    oidc: PublicModuleOptions
  }
}

declare module 'nuxt/schema' {
  interface NuxtConfig {
    oidc?: Partial<ModuleOptions>
  }

  interface RuntimeConfig {
    oidc: ModuleOptions
  }

  interface PublicRuntimeConfig {
    oidc: PublicModuleOptions
  }
}

export {}
`,
    })

    nuxt.hook('prepare:types', ({ nodeReferences, sharedReferences }) => {
      sharedReferences.push({ path: schemaTemplate.dst })
      nodeReferences.push({ path: schemaTemplate.dst })
    })

    nuxt.hook('nitro:prepare:types', ({ references }) => {
      references.push({ path: schemaTemplate.dst })
    })

    const logger = useLogger('nuxt-oidc-auth')
    if (!options.enabled) {
      // Pages that select `oidc-auth` must still resolve while the module is turned off.
      addRouteMiddleware({ name: 'oidc-auth', path: resolve('runtime/middleware/noop') })
      return
    }

    // Types
    nuxt.options.alias['#oidc-auth'] = resolve('./runtime/types')

    // App
    addImportsDir(resolve('./runtime/composables'))
    addPlugin(resolve('./runtime/plugins/session.client'))

    // Server (nitro) plugins
    addPlugin(resolve('./runtime/plugins/session.server'))
    if (options.provideDefaultSecrets === true) {
      addServerPlugin(resolve('./runtime/plugins/provideDefaults'))
    }

    // Server imports
    if (nuxt.options.nitro.imports !== false) {
      nuxt.options.nitro.imports = defu(nuxt.options.nitro.imports, {
        presets: [
          {
            from: resolve('./runtime/server/utils/session'),
            imports: ['sessionHooks'],
          },
          {
            from: resolve('./runtime/server/utils/provider-config'),
            imports: ['useOidcProviderConfig'],
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

    const providers = Object.keys(options.providers).map((provider) => {
      if (!isProviderKey(provider)) {
        throw new Error(`Unknown OIDC provider: ${provider}`)
      }
      return provider
    })
    // Automatically set default provider
    if (!options.defaultProvider && providers.length === 1) {
      options.defaultProvider = providers[0]
    }

    // Gate the dev subsystem on the build-immutable dev-server flag instead of NODE_ENV.
    // A production build (nuxi build/generate) always has nuxt.options.dev === false, so the dev
    // auth-bypass routes can never be baked into a deployed server, regardless of the runtime NODE_ENV.
    const isDevServer = nuxt.options.dev
    const isDevMode = isDevServer && options.devMode?.enabled === true

    if (options.devMode?.enabled === true && !isDevServer) {
      logger.warn('Dev mode is enabled in config but will be ignored outside the dev server.')
    }

    // Add default provider routes
    if (isDevMode) {
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
    } else if (options.defaultProvider) {
      if (options.middleware.customLoginPage !== true) {
        extendRouteRules('/auth/login', {
          redirect: {
            to: `/auth/${options.defaultProvider}/login`,
            statusCode: 302,
          },
        })
      }
      if (options.middleware.customLogoutPage !== true) {
        extendRouteRules('/auth/logout', {
          redirect: {
            to: `/auth/${options.defaultProvider}/logout`,
            statusCode: 302,
          },
        })
      }
    }

    // Dev mode handler
    if (isDevMode) {
      logger.warn('Dev mode is enabled. Do not use in production!')
      logger.info('Dev mode OIDC discovery endpoint: /auth/dev/.well-known/openid-configuration')

      nuxt.options.nitro.storage = defu(nuxt.options.nitro.storage, {
        'oidc:dev': {
          driver: 'fs',
          base: '.nuxt/oidc-dev',
        },
      })

      addServerPlugin(resolve('./runtime/server/plugins/devModeKeys'))

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
      addServerHandler({
        handler: resolve('./runtime/server/handler/devDiscovery'),
        route: '/auth/dev/.well-known/openid-configuration',
        method: 'get',
      })
      addServerHandler({
        handler: resolve('./runtime/server/handler/devJwks'),
        route: '/auth/dev/.well-known/jwks.json',
        method: 'get',
      })
    }

    // Per provider tasks
    for (const provider of providers) {
      Object.assign(options.providers, {
        [provider]: createProviderRuntimeConfig(
          options.providers[provider],
          providerPresets[provider],
        ),
      })

      // Add login handler
      addServerHandler({
        handler: resolve('./runtime/server/handler/login.get'),
        route: `/auth/${provider}/login`,
        method: 'get',
      })
      // Add callback handler
      addServerHandler({
        handler: resolve('./runtime/server/handler/callback'),
        route: `/auth/${provider}/callback`,
        method: 'get',
      })
      // Add callback handler for hybrid flows
      addServerHandler({
        handler: resolve('./runtime/server/handler/callback'),
        route: `/auth/${provider}/callback`,
        method: 'post',
      })
      // Add logout handler
      addServerHandler({
        handler: resolve('./runtime/server/handler/logout.get'),
        route: `/auth/${provider}/logout`,
        method: 'get',
      })
    }

    // oxlint-disable-next-line eslint/no-underscore-dangle -- Nuxt declares _prepare to identify type preparation.
    if (!nuxt.options._prepare) {
      logger.success(`Registered ${providers.length} OIDC providers: ${providers.join(', ')}`)
    }

    // Add auth middleware
    const authMiddlewarePath = resolve('runtime/middleware/oidcAuth')
    if (options.middleware.globalMiddlewareEnabled === true) {
      addRouteMiddleware({
        name: '00.auth.global',
        path: authMiddlewarePath,
        global: true,
      })
    }
    // Pages can always select the guard by name. The global guard already covers them when enabled.
    addRouteMiddleware({
      name: 'oidc-auth',
      path:
        options.middleware.globalMiddlewareEnabled === true
          ? resolve('runtime/middleware/noop')
          : authMiddlewarePath,
    })

    if (providers.length > 0) {
      // Runtime environment overrides are applied after module setup, so SSO support must be available.
      addPlugin(resolve('./runtime/plugins/sso.client'))
      addServerHandler({
        handler: resolve('./runtime/server/api/sso'),
        route: '/api/_auth/sso',
        method: 'get',
      })
    }

    if (options.devtools === true) {
      setupDevToolsUI(nuxt, createResolver(import.meta.url), { isDevMode })
    }

    // Runtime Config
    nuxt.options.runtimeConfig.oidc = defu(nuxt.options.runtimeConfig.oidc, options)
    // Route middleware also runs in the browser, which only receives public runtime config.
    nuxt.options.runtimeConfig.public.oidc = {
      middleware: { redirect: nuxt.options.runtimeConfig.oidc.middleware.redirect !== false },
    }

    // The Nitro dev server runs in a worker that copies process.env when it starts. Generating
    // missing secrets here first lets that worker and the DevTools RPC use the same values.
    if (options.provideDefaultSecrets === true && isDevMode && isRuntimeDevModeEnabled(nuxt)) {
      const generatedSecrets = await provideDefaultSecrets()
      if (generatedSecrets.length > 0 && options.devtools === true) {
        logger.info('Generated secrets are available in Nuxt DevTools under Nuxt OIDC Auth.')
      }
    }
  },
})

/**
 * Module options the browser needs at runtime
 */
export interface PublicModuleOptions {
  middleware: Required<Pick<MiddlewareConfig, 'redirect'>>
}

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
  providers: ProviderRuntimeConfig
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
   * Provide defaults for NUXT_OIDC_SESSION_SECRET, NUXT_OIDC_TOKEN_KEY and NUXT_OIDC_AUTH_SESSION_SECRET using a Nitro plugin. Only a five-character prefix of generated values is logged; on the dev server with dev mode enabled the full values are shown in Nuxt DevTools. Turning this off can lead to the app not working if no secrets are provided.
   * @default true
   */
  provideDefaultSecrets?: boolean
}
