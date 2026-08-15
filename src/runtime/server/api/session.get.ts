import type { UserSession } from '../../types'
import { defineEventHandler, isError } from 'h3'
import { getUserSession, sessionHooks } from '../utils/session'

export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event)
    await sessionHooks.callHookParallel('fetch', session as UserSession, event)
    return session || {}
  } catch (error) {
    if (isError(error) && error.statusCode === 401) return {}
    throw error
  }
})
