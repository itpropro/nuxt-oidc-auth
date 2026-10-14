import type { ConsolaInstance } from 'consola'
import { createConsola } from 'consola'

export function useOidcLogger(): ConsolaInstance {
  return createConsola().withDefaults({ tag: 'nuxt-oidc-auth', message: '[nuxt-oidc-auth]:' })
}
