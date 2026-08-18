import { useRuntimeConfig } from '#imports'
import { createError, eventHandler, getRequestURL } from 'h3'
import { isProductionEnvironment } from '../../utils/environment'

export default eventHandler((event) => {
  if (!import.meta.dev || isProductionEnvironment()) {
    throw createError({ statusCode: 404, message: 'Not Found' })
  }
  const config = useRuntimeConfig().oidc.devMode
  const requestUrl = getRequestURL(event)
  const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`

  return {
    issuer: config?.issuer || 'nuxt:oidc:auth:issuer',
    jwks_uri: `${baseUrl}/auth/dev/.well-known/jwks.json`,
  }
})
