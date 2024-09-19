import {} from 'nuxt/app'
import { defineNuxtPlugin, useOidcAuth } from '#imports'

export default defineNuxtPlugin({
  name: 'session-fetch-plugin',
  enforce: 'pre',
  async setup() {
    await useOidcAuth().fetch()
  },
})
