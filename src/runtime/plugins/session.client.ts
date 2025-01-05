import { defineNuxtPlugin, useOidcAuth } from '#imports'
import {} from 'nuxt/app'

export default defineNuxtPlugin(async (nuxt) => {
  if (!nuxt.payload.serverRendered) {
    nuxt.hook('app:mounted', async () => {
      await useOidcAuth().fetch()
    })
  }
})
