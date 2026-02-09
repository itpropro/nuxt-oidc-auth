import { defineNitroPlugin, useStorage } from 'nitropack/runtime'

export default defineNitroPlugin(async () => {
  const storage = useStorage('oidc:dev')
  await storage.removeItem('keypair')
})
