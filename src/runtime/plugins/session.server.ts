import { defineNuxtPlugin, useOidcAuth, useRuntimeConfig } from '#imports'
import {} from 'nuxt/app'

export default defineNuxtPlugin({
  name: 'session-fetch-plugin',
  enforce: 'pre',
  async setup(nuxt) {
    const config = useRuntimeConfig()
    config.public.oidc.middleware.redirect = config.oidc.middleware.redirect !== false
    if (nuxt.payload.serverRendered) {
      await useOidcAuth().fetch()
    }
  },
})
