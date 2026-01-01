import { defineNitroPlugin, useStorage } from '#imports'

export default defineNitroPlugin(async () => {
  const storage = useStorage('oidc:dev')
  await storage.removeItem('keypair')
})
