import { defineEventHandler } from 'h3'
import { setUserSession } from '../../../../../../src/runtime/server/utils/session'

export default defineEventHandler(async (event) => {
  const now = Math.trunc(Date.now() / 1000)
  return await setUserSession(event, {
    provider: 'oidc',
    canRefresh: false,
    expireAt: now + 3600,
    loggedInAt: now,
    updatedAt: now,
    singleSignOut: true,
  })
})
