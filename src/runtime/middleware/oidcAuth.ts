import type { RouteLocationNormalized } from 'vue-router'
import { defineNuxtRouteMiddleware, useOidcAuth } from '#imports'
import {} from 'nuxt/app'

export default defineNuxtRouteMiddleware(async (to: RouteLocationNormalized) => {
  // 404 exclusion
  const isErrorPage = !(to.matched.length > 0)
  if (isErrorPage) {
    return
  }

  const { loggedIn, login } = useOidcAuth()

  if (loggedIn.value === true || to.path.startsWith('/auth')) {
    return
  }
  await login()
})
