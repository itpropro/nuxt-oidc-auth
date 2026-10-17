import { createError, defineEventHandler } from 'h3'

import { isSameOriginRequest } from '../utils/request'
import {
  getUserSession,
  isProviderUnavailableError,
  refreshUserSession,
  sessionHooks,
} from '../utils/session'

export default defineEventHandler(async (event) => {
  if (!isSameOriginRequest(event)) {
    throw createError({ statusCode: 403, message: 'Cross-origin request blocked' })
  }
  try {
    let session = await getUserSession(event)
    // Skip refresh if getUserSession already refreshed the session recently
    if (
      session.updatedAt === undefined ||
      session.updatedAt === 0 ||
      session.updatedAt < Date.now() / 1000 - 100
    ) {
      session = await refreshUserSession(event)
    }
    await sessionHooks.callHookParallel('refresh', session, event)
    return session
  } catch (error) {
    // The session outlasts a provider outage, so the client must not treat it as signed out.
    if (isProviderUnavailableError(error)) {
      throw error
    }
    return {}
  }
})
