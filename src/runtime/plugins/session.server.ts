import { defineNuxtPlugin, useOidcAuth } from '#imports'
import {} from 'nuxt/app'

export default defineNuxtPlugin({
  name: 'session-fetch-plugin',
  enforce: 'pre',
  async setup() {
    await useOidcAuth().fetch()
  },
})
