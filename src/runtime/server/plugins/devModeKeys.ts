import { defineNitroPlugin, useStorage } from 'nitropack/runtime'

// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return -- Nitro invokes plugins synchronously; retain the existing async cleanup callback despite its void declaration.
export default defineNitroPlugin(async () => {
  const storage = useStorage('oidc:dev')
  await storage.removeItem('keypair')
})
