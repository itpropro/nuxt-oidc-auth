import { createServer, request as httpRequest } from 'node:http'
import { connect } from 'node:net'

import { afterEach, describe, expect, it } from 'vitest'

import { oidc } from '../../src/runtime/providers'
import { resolveProviderConfig } from '../../src/runtime/server/utils/config'
import { createProviderFetch, isProviderTimeout } from '../../src/runtime/server/utils/provider'
import { refreshAccessToken } from '../../src/runtime/server/utils/token-refresh'
import { closeServers, listen } from './local-server'

const multipartFormDataPattern = /^multipart\/form-data; boundary=/u

afterEach(async () => {
  await closeServers()
})

/** A proxy that forwards absolute-form requests, tunnels CONNECT requests and records targets. */
async function startProxy() {
  const targets: string[] = []
  const server = createServer((request, response) => {
    const target = new URL(request.url ?? '')
    targets.push(target.host)
    const upstream = httpRequest(
      target,
      { headers: request.headers, method: request.method },
      (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers)
        upstreamResponse.pipe(response)
      },
    )
    upstream.on('error', () => {
      response.destroy()
    })
    request.pipe(upstream)
  })
  server.on('connect', (request, clientSocket) => {
    const target = new URL(`http://${request.url ?? ''}`)
    targets.push(target.host)
    const upstream = connect(Number(target.port), target.hostname, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      upstream.pipe(clientSocket)
      clientSocket.pipe(upstream)
    })
    upstream.on('error', () => {
      clientSocket.destroy()
    })
    clientSocket.on('error', () => {
      upstream.destroy()
    })
  })
  return { targets, url: await listen(server) }
}

describe('provider requests through a proxy', () => {
  it('refresh tokens with a form body', async () => {
    const received: { contentType?: string; body: string }[] = []
    const tokenUrl = `${await listen(
      createServer((request, response) => {
        let body = ''
        request.on('data', (chunk: Buffer) => {
          body += chunk.toString()
        })
        request.on('end', () => {
          received.push({ contentType: request.headers['content-type'], body })
          response.writeHead(200, { 'content-type': 'application/json' })
          response.end(JSON.stringify({ access_token: 'proxied-access-token', expires_in: 300 }))
        })
      }),
    )}/token`
    const proxy = await startProxy()

    const result = await refreshAccessToken(
      'proxied-refresh-token',
      resolveProviderConfig(
        {
          clientId: 'proxy-client',
          clientSecret: 'proxy-secret',
          proxy: proxy.url,
          skipAccessTokenParsing: true,
          tokenRequestType: 'form',
          tokenUrl,
          tokenValidationMode: 'legacy',
        },
        oidc,
      ),
    )

    expect(result.tokens.accessToken).toBe('proxied-access-token')
    expect(proxy.targets).toStrictEqual([new URL(tokenUrl).host])
    expect(received).toHaveLength(1)
    expect(received[0]?.contentType).toMatch(multipartFormDataPattern)
    expect(received[0]?.body).toContain('proxied-refresh-token')
  })

  it('keep the cancellation of a Request input', async () => {
    let requests = 0
    const url = await listen(
      createServer((_request, response) => {
        requests += 1
        response.end('{}')
      }),
    )
    const proxy = await startProxy()
    const providerFetch = await createProviderFetch(
      resolveProviderConfig({ proxy: proxy.url, requestTimeout: 1000 }, oidc),
    )
    const controller = new AbortController()
    controller.abort(new Error('Cancelled by the caller'))

    let failure: unknown
    try {
      await providerFetch(new Request(url, { method: 'POST', signal: controller.signal }))
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(Error)
    expect(isProviderTimeout(failure)).toBe(false)
    expect(proxy.targets).toStrictEqual([])
    expect(requests).toBe(0)
  })

  it('abort a request without a response after requestTimeout', async () => {
    const url = await listen(createServer())
    const proxy = await startProxy()
    const providerFetch = await createProviderFetch(
      resolveProviderConfig({ proxy: proxy.url, requestTimeout: 50 }, oidc),
    )

    let error: unknown
    try {
      await providerFetch(url, { method: 'POST' })
    } catch (requestError) {
      error = requestError
    }

    expect(isProviderTimeout(error)).toBe(true)
    expect(proxy.targets).toStrictEqual([new URL(url).host])
  })
})
