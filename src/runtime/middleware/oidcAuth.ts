import { useOidcAuth, defineNuxtRouteMiddleware } from '#imports'

export default defineNuxtRouteMiddleware(async (to) => {
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
