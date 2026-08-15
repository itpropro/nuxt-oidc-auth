import type { CryptoKey, JWK } from 'jose'
import type { IncomingMessage } from 'node:http'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { importJWK, SignJWT } from 'jose'

const signingJwk = {
  kty: 'EC',
  x: 'Ezof6Qu3EUslMY99jjIZQVxMwOq7hL29bhcLwkyIF3U',
  y: 'NUsaVIHGf0c5hjkD-COnYHZ3yvRYjrKe-3C2hxOEc0s',
  crv: 'P-256',
  d: 'X9n0_X0bpa2kgOUK4Dqqriv4k8hblqd-HDzk3dejq_c',
  alg: 'ES256',
  use: 'sig',
  kid: 'offline-signing-key',
} satisfies JWK

const untrustedSigningJwk = {
  kty: 'EC',
  x: 'Nnq26ug7QVdRFfa4Yh5bRxO9rBdsL0ji2GdlI6fbW5c',
  y: '8hDanF57LBFjcYujJTaANxGifIW0vk9-lZkk01oE5ig',
  crv: 'P-256',
  d: 'dKxgGIjchC8m4Wnr6j23GuEt6XLMPrMqKfSLnPfYqI0',
  alg: 'ES256',
  use: 'sig',
  kid: 'offline-untrusted-key',
} satisfies JWK

const publicSigningJwk = {
  kty: signingJwk.kty,
  x: signingJwk.x,
  y: signingJwk.y,
  crv: signingJwk.crv,
  alg: signingJwk.alg,
  use: signingJwk.use,
  kid: signingJwk.kid,
}

export type TokenFault =
  | 'audience-mismatch'
  | 'invalid-signature'
  | 'issuer-mismatch'
  | 'nonce-mismatch'

let tokenRequestCount = 0
let userInfoAvailable = true
let lastLogoutRedirect: string | null = null
let blockedTokenRequest: Promise<void> | undefined
let tokenRequestStarted: (() => void) | undefined
let tokenFault: TokenFault | undefined

async function readRequestBody(request: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return new URLSearchParams(Buffer.concat(chunks).toString())
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

async function signToken(
  payload: Record<string, unknown>,
  signingKey: CryptoKey | Uint8Array,
): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({
      alg: signingJwk.alg,
      kid: signingJwk.kid,
      typ: 'JWT',
    })
    .sign(signingKey)
}

export async function startFaultOidcProvider(expectedLogoutRedirect: string, port = 0) {
  const trustedSigningKey = await importJWK(signingJwk, signingJwk.alg)
  const untrustedSigningKey = await importJWK(untrustedSigningJwk, untrustedSigningJwk.alg)
  const authorizationNonces = new Map<string, string>()
  let origin = ''

  async function tokenResponse(requestIndex: number, requestBody: URLSearchParams) {
    const now = Math.trunc(Date.now() / 1000)
    const identity = requestIndex >= 3 ? 'second-user' : 'first-user'
    const role = requestIndex === 1 ? 'admin-role' : 'user-role'
    const issuer = tokenFault === 'issuer-mismatch' ? `${origin}/unexpected` : origin
    const accessAudience =
      tokenFault === 'audience-mismatch' ? 'unexpected-audience' : 'browser-api'
    const idAudience = tokenFault === 'audience-mismatch' ? 'unexpected-client' : 'browser-client'
    const code = requestBody.get('code')
    const requestedNonce = code ? authorizationNonces.get(code) : undefined
    const nonce = tokenFault === 'nonce-mismatch' ? 'unexpected-nonce' : requestedNonce
    const signingKey = tokenFault === 'invalid-signature' ? untrustedSigningKey : trustedSigningKey

    return {
      access_token: await signToken(
        {
          aud: accessAudience,
          exp: now + 3600,
          iat: now,
          iss: issuer,
          name: identity,
          sub: identity,
        },
        signingKey,
      ),
      id_token: await signToken(
        {
          aud: idAudience,
          exp: now + 3600,
          iat: now,
          iss: issuer,
          ...(nonce && { nonce }),
          resource_access: { playground: { roles: [role] } },
          sub: identity,
        },
        signingKey,
      ),
      refresh_token: `refresh-token-${requestIndex}`,
      token_type: 'Bearer',
      expires_in: 3600,
    }
  }

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host}`)

    if (requestUrl.pathname === '/.well-known/openid-configuration') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify({
          issuer: origin,
          authorization_endpoint: `${origin}/authorize`,
          token_endpoint: `${origin}/token`,
          userinfo_endpoint: `${origin}/userinfo`,
          end_session_endpoint: `${origin}/logout`,
          jwks_uri: `${origin}/jwks`,
          response_types_supported: ['code'],
          subject_types_supported: ['public'],
          id_token_signing_alg_values_supported: ['ES256'],
        }),
      )
      return
    }

    if (requestUrl.pathname === '/jwks') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ keys: [publicSigningJwk] }))
      return
    }

    if (requestUrl.pathname === '/authorize') {
      const redirectUri = requestUrl.searchParams.get('redirect_uri')
      const state = requestUrl.searchParams.get('state')
      const nonce = requestUrl.searchParams.get('nonce')
      if (!redirectUri || !state || !nonce) {
        response.writeHead(400).end()
        return
      }

      const code = `code-${tokenRequestCount + 1}`
      authorizationNonces.set(code, nonce)
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end(`<!doctype html>
<form id="callback" method="post" action="${escapeHtml(redirectUri)}">
  <input type="hidden" name="code" value="${escapeHtml(code)}">
  <input type="hidden" name="state" value="${escapeHtml(state)}">
</form>
<script>document.getElementById('callback').submit()</script>`)
      return
    }

    if (requestUrl.pathname === '/token') {
      const requestBody = await readRequestBody(request)
      tokenRequestCount += 1
      if (blockedTokenRequest) {
        const release = blockedTokenRequest
        blockedTokenRequest = undefined
        tokenRequestStarted?.()
        await release
      }
      userInfoAvailable = tokenRequestCount < 3
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify(await tokenResponse(tokenRequestCount, requestBody)))
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
  origin = `http://127.0.0.1:${address.port}`

  return {
    origin,
    reset() {
      tokenRequestCount = 0
      userInfoAvailable = true
      lastLogoutRedirect = null
      blockedTokenRequest = undefined
      tokenRequestStarted = undefined
      tokenFault = undefined
      authorizationNonces.clear()
    },
    setTokenFault(fault: TokenFault) {
      tokenFault = fault
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
