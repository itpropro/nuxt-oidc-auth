import { defineNitroPlugin } from 'nitropack/runtime'

import { provideDefaultSecrets } from '../server/utils/default-secrets'

// oxlint-disable-next-line typescript/no-misused-promises, typescript/strict-void-return -- Preserve the existing async callback and returned Promise despite Nitro's void plugin declaration.
export default defineNitroPlugin(async () => {
  await provideDefaultSecrets()
})
