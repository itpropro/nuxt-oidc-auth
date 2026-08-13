import { once } from 'node:events'
import { createServer } from 'node:http'

let tokenRequestCount = 0
let userInfoAvailable = true
let lastLogoutRedirect: string | null = null
let blockedTokenRequest: Promise<void> | undefined
let tokenRequestStarted: (() => void) | undefined

function jwt(payload: Record<string, unknown>): string {
  const encodedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
    'base64url',
  )
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encodedHeader}.${encodedPayload}.signature`
}

function tokenResponse(requestIndex: number) {
  const now = Math.trunc(Date.now() / 1000)
  const identity = requestIndex >= 3 ? 'second-user' : 'first-user'
  const role = requestIndex === 1 ? 'admin-role' : 'user-role'

  return {
    access_token: jwt({ sub: identity, name: identity, iat: now, exp: now + 3600 }),
    id_token: jwt({
      sub: identity,
      iat: now,
      exp: now + 3600,
      resource_access: { playground: { roles: [role] } },
    }),
    refresh_token: `refresh-token-${requestIndex}`,
    token_type: 'Bearer',
    expires_in: 3600,
  }
}

export async function startFaultOidcProvider(expectedLogoutRedirect: string, port = 0) {
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host}`)

    if (requestUrl.pathname === '/authorize') {
      const redirectUri = requestUrl.searchParams.get('redirect_uri')
      const state = requestUrl.searchParams.get('state')
      if (!redirectUri || !state) {
        response.writeHead(400).end()
        return
      }

      const callback = new URL(redirectUri)
      callback.searchParams.set('code', `code-${tokenRequestCount + 1}`)
      callback.searchParams.set('state', state)
      response.writeHead(302, { location: callback.toString() }).end()
      return
    }

    if (requestUrl.pathname === '/token') {
      tokenRequestCount += 1
      if (blockedTokenRequest) {
        const release = blockedTokenRequest
        blockedTokenRequest = undefined
        tokenRequestStarted?.()
        await release
      }
      userInfoAvailable = tokenRequestCount < 3
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify(tokenResponse(tokenRequestCount)))
      return
    }

    if (requestUrl.pathname === '/userinfo') {
      if (!userInfoAvailable) {
        response.writeHead(404, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ error: 'not_found' }))
        return
      }

      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ displayName: 'First User' }))
      return
    }

    if (requestUrl.pathname === '/logout') {
      lastLogoutRedirect = requestUrl.searchParams.get('post_logout_redirect_uri')
      response.writeHead(302, { location: expectedLogoutRedirect }).end()
      return
    }

    response.writeHead(404).end()
  })

  server.listen(port, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Fault provider did not bind a TCP port')
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    reset() {
      tokenRequestCount = 0
      userInfoAvailable = true
      lastLogoutRedirect = null
      blockedTokenRequest = undefined
      tokenRequestStarted = undefined
    },
    blockNextTokenRequest() {
      let releaseTokenRequest: () => void = () => {}
      const tokenRequestReached = new Promise<void>((resolve) => {
        tokenRequestStarted = resolve
      })
      blockedTokenRequest = new Promise<void>((resolve) => {
        releaseTokenRequest = resolve
      })
      return { releaseTokenRequest, tokenRequestReached }
    },
    getLastLogoutRedirect: () => lastLogoutRedirect,
    getTokenRequestCount: () => tokenRequestCount,
    async close() {
      server.close()
      await once(server, 'close')
    },
  }
}
