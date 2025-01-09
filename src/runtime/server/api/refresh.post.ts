import type { UserSession } from '../../types'
import { eventHandler } from 'h3'
import { getUserSession, refreshUserSession, sessionHooks } from '../utils/session'

export default eventHandler(async (event) => {
  let session = await getUserSession(event)
  if (session) {
    // Handle, if getUserSession already refreshed it
    if (session.updatedAt && session.updatedAt < Date.now() / 1000 - 100) {
      session = await refreshUserSession(event) as UserSession
    }
    await sessionHooks.callHookParallel('refresh', session, event)
  }
  return session
})
