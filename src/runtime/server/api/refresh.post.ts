import { eventHandler } from 'h3'
import { refreshUserSession } from '../utils/session'

export default eventHandler(async (event) => {
  const session = await requireUserSession(event)
  
  await sessionHooks.callHookParallel('refresh', session, event)
  await refreshUserSession(event)

  return { refreshed: true }
})
