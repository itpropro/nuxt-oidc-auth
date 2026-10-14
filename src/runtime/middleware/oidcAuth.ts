import { abortNavigation, defineNuxtRouteMiddleware, useOidcAuth, useRuntimeConfig } from '#imports'

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

export default defineNuxtRouteMiddleware(async (to): Promise<boolean | undefined> => {
  if (to.meta.oidcAuth?.enabled === false) {
    return
  }
  const isErrorPage = to.matched.length === 0
  if (isErrorPage) {
    return
  }
  const { loggedIn, login } = useOidcAuth()

  if (loggedIn.value || to.path.startsWith('/auth/')) {
    return
  }
  if (!useRuntimeConfig().public.oidc.middleware.redirect) {
    return
  }
  await login(undefined, { callbackRedirectUrl: to.fullPath })
  // The browser leaves for the login page, so keep the router from rendering the protected page meanwhile.
  // oxlint-disable-next-line typescript/consistent-return -- Nuxt continues on no return value and aborts navigation on false.
  return import.meta.client ? abortNavigation() : undefined
})
