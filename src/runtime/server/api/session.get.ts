import type { UserSession } from '#oidc-auth'
import { defineEventHandler, sendRedirect } from 'h3'
import { getUserSession, sessionHooks } from '../utils/session'

export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event)
    await sessionHooks.callHookParallel('fetch', session as UserSession, event)
    return session || {}
  }
  catch {
    return {}
  }
})
