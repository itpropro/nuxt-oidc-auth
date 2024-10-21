import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  ssr: true,

  extends: ['@nuxt/ui-pro'],

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

  future: {
    compatibilityVersion: 4,
  },

  hooks: {
    'components:extend': (components) => {
      const globals = components.filter(c => ['UButton', 'UIcon', 'UAlert'].includes(c.pascalName))
      globals.forEach(c => c.global = true)
    },
  },

  routeRules: {
    '/': { prerender: true },
    '/api/search.json': { prerender: true },
    '/sitemap.xml': { prerender: true },
  },

  $production: {
    scripts: {
      registry: {
        plausibleAnalytics: {
          domain: 'nuxtoidc.cloud',
        },
      },
    },
  },

  ogImage: {
    zeroRuntime: true,
  },

  app: {
    head: {
      seoMeta: {
        themeColor: [
          { content: '#18181b', media: '(prefers-color-scheme: dark)' },
          { content: 'white', media: '(prefers-color-scheme: light)' },
        ],
      },
      templateParams: {
        separator: '·',
      },
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
    collections: ['simple-icons', 'carbon', 'heroicons', 'vscode-icons'],
    clientBundle: {
      scan: true,
    },
    serverBundle: {
      collections: ['simple-icons', 'carbon', 'heroicons', 'vscode-icons'],
    },
  },

  site: {
    name: 'Nuxt OIDC Auth Docs',
    url: 'nuxtoidc.cloud',
  },

  sitemap: {
    strictNuxtContentPaths: true,
  },

  devtools: {
    enabled: true,

    timeline: {
      enabled: true,
    },
  },

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/'],
      failOnError: false,
    },
    preset: 'azure',
  },

  compatibilityDate: '2024-07-03',
})
