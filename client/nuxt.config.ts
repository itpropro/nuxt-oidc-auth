import { resolve } from 'pathe'

export default defineNuxtConfig({
  ssr: false,
  modules: [
    '@nuxt/devtools-ui-kit',
  ],
  nitro: {
    output: {
      publicDir: resolve(__dirname, '../dist/client'),
    },
  },
  app: {
    baseURL: '/__nuxt-oidc-auth',
  },
  unocss: {
    shortcuts: {
      // General Tokens
      'bg-base': 'n-bg-base',
      'bg-active': 'n-bg-active',
      'border-base': 'n-border-base',
      'text-secondary': 'color-black/50 dark:color-white/50',
      // Reusable
      'x-divider': 'h-1px w-full bg-gray/15',
    },
  },
  experimental: {
    componentIslands: true,
  },
  compatibilityDate: '2024-09-19',
})
