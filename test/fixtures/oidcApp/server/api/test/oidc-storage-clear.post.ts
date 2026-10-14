import { defineEventHandler, useSession } from 'h3'
import { useStorage } from 'nitropack/runtime'

const DEFAULT_SESSION_NAME = 'nuxt-oidc-auth'

export default defineEventHandler(async (event) => {
  const password = process.env['NUXT_OIDC_SESSION_SECRET']
  if (password === undefined) {
    throw new Error('Missing test session secret')
  }
  const session = await useSession(event, {
    name: DEFAULT_SESSION_NAME,
    password,
  })

  if (session.id === undefined) {
    throw new Error('Missing test session ID')
  }
  await useStorage('oidc').removeItem(session.id)

  return {
    removed: true,
  }
})
