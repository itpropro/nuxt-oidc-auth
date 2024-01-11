import { eventHandler } from 'h3'
import { refreshUserSession, requireUserSession } from '../utils/session'

export default eventHandler(async (event) => {
  await requireUserSession(event)
  await refreshUserSession(event)

  return { refreshed: true }
})
