import { getUserSession } from '../../../../../../src/runtime/server/utils/session'

export default defineEventHandler(async (event) => await getUserSession(event))
