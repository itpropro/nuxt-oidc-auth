import {} from 'nuxt/app'

import { defineNuxtPlugin, useOidcAuth } from '#imports'

export default defineNuxtPlugin(async (nuxt) => {
  if (!nuxt.payload.serverRendered) {
    nuxt.hook('app:mounted', async () => {
      await useOidcAuth().fetch()
    })
  }
})
