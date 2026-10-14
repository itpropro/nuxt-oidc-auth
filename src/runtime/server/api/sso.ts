import { createError, createEventStream, defineEventHandler } from 'h3'
import { useStorage } from 'nitropack/runtime'

import {
  getSingleSignOutSessionId,
  getUserSession,
  getUserSessionId,
  hasEligibleSingleSignOutSessionCookie,
  logoutHooks,
} from '../utils/session'

function unauthorized(): never {
  throw createError({
    statusCode: 401,
    message: 'Unauthorized',
  })
}

export default defineEventHandler(async (event) => {
  if (!(await hasEligibleSingleSignOutSessionCookie(event))) {
    unauthorized()
  }
  const userSession = await getUserSession(event)
  if (userSession.singleSignOut !== true) {
    unauthorized()
  }

  const sessionId = await getSingleSignOutSessionId(event)
  if (sessionId === undefined || sessionId === '') {
    unauthorized()
  }
  const userSessionId = await getUserSessionId(event)
  const eventStream = createEventStream(event)

  let firstCall = false
  const logoutHook = logoutHooks.hook(sessionId, async () => {
    if (!firstCall) {
      firstCall = true
      void (async () => {
        await useStorage('oidc').removeItem(userSessionId)
        logoutHook()
      })()
    }
    await eventStream.push({
      event: 'logout',
      data: '',
    })
  })
  eventStream.onClosed(() => {
    logoutHook()
  })
  await eventStream.send()
})
