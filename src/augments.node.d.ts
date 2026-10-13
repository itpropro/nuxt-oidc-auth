import type { ModuleOptions, PublicModuleOptions } from './module'

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
