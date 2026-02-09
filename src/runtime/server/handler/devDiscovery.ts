import { useRuntimeConfig } from '#imports'
import { eventHandler, getRequestURL } from 'h3'

export default eventHandler((event) => {
  const config = useRuntimeConfig().oidc.devMode
  const requestUrl = getRequestURL(event)
  const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`

  return {
    issuer: config?.issuer || 'nuxt:oidc:auth:issuer',
    jwks_uri: `${baseUrl}/auth/dev/.well-known/jwks.json`,
  }
})
