import { defineEventHandler } from 'h3'
import { getUserSession } from '../../../../../../src/runtime/server/utils/session'

export default defineEventHandler(async (event) => {
  return await getUserSession(event, { errorBehavior: 'throw' })
})
