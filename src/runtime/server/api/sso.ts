import { createError, createEventStream, defineEventHandler } from 'h3'

import {
  getSingleSignOutSessionId,
  getUserSession,
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
  const eventStream = createEventStream(event)

  // Only notifies this process's clients. The sign-out already revoked their sessions in storage.
  const logoutHook = logoutHooks.hook(sessionId, async (provider) => {
    // The same identity at another provider is a different single sign-out group
    if (provider !== undefined && provider !== userSession.provider) {
      return
    }
    logoutHook()
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
