import { createError, defineEventHandler } from 'h3'
import { isSameOriginRequest } from '../utils/request'
import { clearUserSession } from '../utils/session'

export default defineEventHandler(async (event) => {
  if (!isSameOriginRequest(event)) {
    throw createError({ statusCode: 403, message: 'Cross-origin request blocked' })
  }
  await clearUserSession(event)
  return { loggedOut: true }
})
