import { defineEventHandler, useSession } from 'h3'
import { useStorage } from 'nitropack/runtime'

const DEFAULT_SESSION_NAME = 'nuxt-oidc-auth'

export default defineEventHandler(async (event) => {
  const session = await useSession(event, {
    name: DEFAULT_SESSION_NAME,
    password: process.env.NUXT_OIDC_SESSION_SECRET as string,
  })

  await useStorage('oidc').removeItem(session.id as string)

  return {
    removed: true,
  }
})
