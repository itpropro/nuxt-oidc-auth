import { useRuntimeConfig } from '#imports'

/**
 * Adds Nuxt baseURL to the passed path if set
 */
export function parsePath(path: string) {
  const nuxtBaseUrl: string = useRuntimeConfig().app.baseURL ?? '/'
  return `${nuxtBaseUrl}${path.startsWith('/') ? path.slice(1) : path}`
}
