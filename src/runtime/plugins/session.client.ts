import { defineNuxtPlugin, useOidcAuth } from '#imports'

export default defineNuxtPlugin(async (nuxt) => {
  if (nuxt.payload.serverRendered !== true) {
    nuxt.hook('app:mounted', async () => {
      await useOidcAuth().fetch()
    })
  }
})
