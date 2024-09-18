import { eventHandler } from 'h3'
import { getUserSession, refreshUserSession } from '../utils/session'

export default eventHandler(async (event) => {
  await getUserSession(event)
  await refreshUserSession(event)
  return { refreshed: true }
})
