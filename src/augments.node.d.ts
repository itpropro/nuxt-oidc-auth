import type { ModuleOptions } from './module'

declare module '@nuxt/schema' {
  interface NuxtConfig {
    oidc?: Partial<ModuleOptions>
  }

  interface RuntimeConfig {
    oidc: ModuleOptions
  }
}

declare module 'nuxt/schema' {
  interface NuxtConfig {
    oidc?: Partial<ModuleOptions>
  }

  interface RuntimeConfig {
    oidc: ModuleOptions
  }
}

export {}
