import { useRuntimeConfig } from '#imports'
import { createError, eventHandler } from 'h3'
import { getDevModeJwks } from '../utils/devModeKeys'
import { isProductionEnvironment } from '../../utils/environment'

export default eventHandler(async () => {
  if (!import.meta.dev || isProductionEnvironment()) {
    throw createError({ statusCode: 404, message: 'Not Found' })
  }
  const config = useRuntimeConfig().oidc.devMode
  if (config?.tokenAlgorithm === 'symmetric') {
    return { keys: [] }
  }
  return await getDevModeJwks()
})
