import { defineNitroPlugin, useStorage } from 'nitropack/runtime'

// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return -- Nitro awaits plugins during initialization; key cleanup must finish before handling requests despite its void plugin declaration.
export default defineNitroPlugin(async () => {
  const storage = useStorage('oidc:dev')
  await storage.removeItem('keypair')
})
