import { defineEventHandler } from 'h3'
import { getUserSession, setUserSession } from '../../../../../../src/runtime/server/utils/session'

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  return await setUserSession(event, { ...session, updatedAt: 1 })
})
