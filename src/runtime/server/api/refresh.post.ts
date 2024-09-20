import { eventHandler } from 'h3'
import { getUserSession, refreshUserSession, sessionHooks } from '../utils/session'

export default eventHandler(async (event) => {
  await getUserSession(event)
  const session = await refreshUserSession(event)
  await sessionHooks.callHookParallel('refresh', session, event)
  return session
})
