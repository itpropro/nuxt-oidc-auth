import { defineNuxtConfig } from 'nuxt/config'

const plausibleScriptId = process.env.NUXT_PUBLIC_PLAUSIBLE_SCRIPT_ID

export default defineNuxtConfig({
  modules: [
    '@nuxt/fonts',
    '@nuxt/content',
    '@vueuse/nuxt',
    '@nuxt/scripts',
    '@nuxt/ui',
    '@nuxtjs/seo',
    '@nuxt/image',
    'nuxt-vitalizer',
  ],

  $production: {
    scripts: {
      registry: {
        ...(plausibleScriptId ? { plausibleAnalytics: { scriptId: plausibleScriptId, proxy: false } } : {}),
      },
    },
  },

  ssr: true,

  devtools: {
    enabled: true,

    timeline: {
      enabled: true,
    },
  },

  app: {
    head: {
      meta: [
        { name: 'theme-color', content: '#18181b', media: '(prefers-color-scheme: dark)' },
        { name: 'theme-color', content: 'white', media: '(prefers-color-scheme: light)' },
      ],
      templateParams: {
        separator: '·',
      },
    },
  },

  css: ['~/assets/css/main.css'],

  site: {
    name: 'Nuxt OIDC Auth Docs',
    url: 'nuxtoidc.cloud',
  },

  content: {
    experimental: {
      sqliteConnector: 'native',
    },
  },

  routeRules: {
    '/': { prerender: true },
    '/sitemap.xml': { prerender: true },
  },

  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: '2024-07-03',

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', '/provider/logto', '/sitemap.xml'],
      failOnError: true,
    },
  },

  hooks: {
    'components:extend': (components) => {
      const globals = components.filter(c => ['UButton', 'UIcon', 'UAlert'].includes(c.pascalName))
      globals.forEach(c => c.global = true)
    },
  },

  fonts: {
    families: [
      { name: 'DM Sans', provider: 'bunny', weights: [400, 700] },
    ],
    providers: {
      google: false,
    },
  },

  icon: {
    collections: ['simple-icons', 'carbon', 'heroicons'],
    clientBundle: {
      icons: ['carbon:bare-metal-server', 'carbon:block-storage', 'carbon:book', 'carbon:code'],
      scan: {
        globInclude: ['app/**/*.{vue,ts}', 'content/**/*.{md,yml,yaml}'],
      },
    },
    serverBundle: {
      collections: ['simple-icons', 'carbon', 'heroicons'],
    },
  },

  ogImage: {
    zeroRuntime: true,
  },
})
