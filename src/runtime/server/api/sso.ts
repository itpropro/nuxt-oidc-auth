import { createError, createEventStream, defineEventHandler } from 'h3'
import { useStorage } from 'nitropack/runtime'
import { getSingleSignOutSessionId, getUserSessionId, logoutHooks } from '../utils/session'

export default defineEventHandler(async (event) => {
  const sessionId = await getSingleSignOutSessionId(event)
  if (!sessionId) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }
  const userSessionId = await getUserSessionId(event)
  const eventStream = createEventStream(event)

  let logoutHook: () => void

  const cleanupHook = async () => {
    await useStorage('oidc').removeItem(userSessionId)
    logoutHook()
  }

  let firstCall = false
  logoutHook = logoutHooks.hook(sessionId, async () => {
    if (!firstCall) {
      firstCall = true
      cleanupHook()
    }
    await eventStream.push({
      event: 'logout',
      data: '',
    })
  })
  return eventStream.send()
})
