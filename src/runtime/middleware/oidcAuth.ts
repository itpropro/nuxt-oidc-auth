import type { RouteLocationNormalized } from 'vue-router'
import { defineNuxtRouteMiddleware, useOidcAuth, useRuntimeConfig } from '#imports'

interface MiddlewareOptions {
  /**
   * Whether to enable the middleware.
   *
   * @default true
   */
  enabled: boolean
}

declare module '#app' {
  interface PageMeta {
    oidcAuth?: MiddlewareOptions
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    oidcAuth?: MiddlewareOptions
  }
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.meta.oidcAuth?.enabled === false) {
    return
  }
  const isErrorPage = !(to.matched.length > 0)
  if (isErrorPage) {
    return
  }
  const { loggedIn, login } = useOidcAuth()

  if (loggedIn.value === true || to.path.startsWith('/auth/')) {
    return
  }
  if (useRuntimeConfig().oidc?.middleware?.redirect === false) {
    return
  }
  await login()
})
