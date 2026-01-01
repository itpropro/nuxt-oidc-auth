import { eventHandler, useRuntimeConfig } from '#imports'
import { getDevModeJwks } from '../utils/devModeKeys'

export default eventHandler(async () => {
  const config = useRuntimeConfig().oidc.devMode
  if (config?.tokenAlgorithm === 'symmetric') {
    return { keys: [] }
  }
  return await getDevModeJwks()
})
