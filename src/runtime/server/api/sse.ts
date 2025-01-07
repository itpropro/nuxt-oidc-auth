import { createEventStream, defineEventHandler } from 'h3'
import { getUserSessionId, logoutHooks } from '../utils/session'

export default defineEventHandler(async (event) => {
  const sessionId = await getUserSessionId(event)
  const eventStream = createEventStream(event)

  let firstCall = false
  const logoutHook = logoutHooks.hook(sessionId, async () => {
    if (!firstCall) {
      firstCall = true
      setTimeout(() => {
        logoutHook()
      }, 5000)
    }
    await eventStream.push({
      event: 'logout',
      data: '',
    })
  })
  return eventStream.send()
})
