import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'

import { createEvent } from 'h3'

export function createRequestEvent(cookie = '', path = '/'): ReturnType<typeof createEvent> {
  const request = new IncomingMessage(new Socket())
  request.headers = { cookie }
  request.method = 'GET'
  request.url = path
  return createEvent(request, new ServerResponse(request))
}
