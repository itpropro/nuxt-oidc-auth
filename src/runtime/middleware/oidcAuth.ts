import { defineNuxtRouteMiddleware } from '#app'
import { useOidcAuth } from '#imports'

export default defineNuxtRouteMiddleware(async (to, from) => {
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
