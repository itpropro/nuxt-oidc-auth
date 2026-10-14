import { defineNuxtRouteMiddleware } from '#imports'

export default defineNuxtRouteMiddleware(() => {
  // Keep the registered middleware inactive when authentication is disabled.
})
