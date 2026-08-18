import type { UserSession } from '../../types'
import { createError, defineEventHandler } from 'h3'
import { isSameOriginRequest } from '../utils/request'
import { getUserSession, refreshUserSession, sessionHooks } from '../utils/session'

export default defineEventHandler(async (event) => {
  if (!isSameOriginRequest(event)) {
    throw createError({ statusCode: 403, message: 'Cross-origin request blocked' })
  }
  try {
    let session = await getUserSession(event)
    if (session) {
      // Skip refresh if getUserSession already refreshed the session recently
      if (!session.updatedAt || session.updatedAt < Date.now() / 1000 - 100) {
        session = (await refreshUserSession(event)) as UserSession
      }
      await sessionHooks.callHookParallel('refresh', session, event)
      return session
    }
  } catch {
    return {}
  }
})
