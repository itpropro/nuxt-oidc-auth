import { createError, eventHandler } from 'h3'

import { useRuntimeConfig } from '#imports'

import { isProductionEnvironment } from '../../utils/environment'
import { getDevModeJwks } from '../utils/devModeKeys'

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
