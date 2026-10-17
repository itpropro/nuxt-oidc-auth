import { createServer } from 'node:http'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { oidc } from '../../src/runtime/providers'
import { resolveProviderConfig } from '../../src/runtime/server/utils/config'
import { createProviderFetch, isProviderTimeout } from '../../src/runtime/server/utils/provider'
import { interceptFetch } from './handler-harness'
import { closeServers, listen } from './local-server'
import type { TokenAnswer } from './refresh-harness'
import {
  createHarness,
  expectSessionKept,
  getSession,
  inSeconds,
  refresh,
  refreshedTokens,
  seedSession,
  tokenKey,
  tokenRoute,
} from './refresh-harness'

beforeEach(() => {
  vi.stubEnv('NUXT_OIDC_TOKEN_KEY', tokenKey)
})

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  await closeServers()
})

/** A provider that keeps the request open until the client aborts it, like real fetch. */
async function hang(request: Request): Promise<Response> {
  return await new Promise((_resolve, reject) => {
    request.signal.addEventListener(
      'abort',
      () => {
        const reason: unknown = request.signal.reason
        reject(reason instanceof Error ? reason : new Error('Request aborted'))
      },
      { once: true },
    )
  })
}

async function requestError(
  url: string | Request,
  config: Parameters<typeof resolveProviderConfig>[0],
  method = 'POST',
): Promise<unknown> {
  const providerFetch = await createProviderFetch(resolveProviderConfig(config, oidc))
  try {
    await providerFetch(url, { method })
  } catch (error) {
    return error
  }
  return null
}

describe('provider request timeout', () => {
  it('aborts a request without a response', async () => {
    const url = await listen(createServer())

    expect(isProviderTimeout(await requestError(url, { requestTimeout: 50 }))).toBe(true)
  })

  it('aborts a response body that does not arrive', async () => {
    const url = await listen(
      createServer((_request, response) => {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.write('{')
      }),
    )

    expect(isProviderTimeout(await requestError(url, { requestTimeout: 50 }))).toBe(true)
  })

  it('aborts a retried request that does not answer', async () => {
    let requests = 0
    const url = await listen(
      createServer((_request, response) => {
        requests += 1
        if (requests === 1) {
          response.writeHead(503)
          response.end('unavailable')
        }
      }),
    )

    expect(isProviderTimeout(await requestError(url, { requestTimeout: 50 }, 'GET'))).toBe(true)
    expect(requests).toBe(2)
  })

  it('keeps the cancellation of a Request input', async () => {
    let requests = 0
    const url = await listen(
      createServer((_request, response) => {
        requests += 1
        response.end('{}')
      }),
    )
    const controller = new AbortController()
    controller.abort(new Error('Cancelled by the caller'))

    const error = await requestError(
      new Request(url, { method: 'POST', signal: controller.signal }),
      {
        requestTimeout: 1000,
      },
    )

    expect(error).toBeInstanceOf(Error)
    expect(isProviderTimeout(error)).toBe(false)
    expect(requests).toBe(0)
  })

  it('waits 10 seconds by default', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const url = 'https://identity.example.test/slow'
    interceptFetch([{ url, respond: hang }])
    let settled = false
    const outcome = (async () => {
      const error = await requestError(url, {})
      settled = true
      return error
    })()

    await vi.advanceTimersByTimeAsync(9999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    expect(isProviderTimeout(await outcome)).toBe(true)
  })
})

describe('refreshes after a timeout', () => {
  it('make no token request for 30 seconds, then refresh again', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const harness = createHarness({ requestTimeout: 50 })
    const persistentSession = await seedSession(harness)
    let answer: TokenAnswer = hang
    const interceptor = interceptFetch([tokenRoute(async (request) => await answer(request))])

    await expect(refresh(harness)).resolves.toMatchObject({ result: { statusCode: 503 } })
    vi.setSystemTime(Date.now() + 29_000)
    await expect(refresh(harness)).resolves.toMatchObject({ result: { statusCode: 503 } })

    expect(interceptor.requests).toHaveLength(1)
    expectSessionKept(harness, persistentSession)

    answer = refreshedTokens
    vi.setSystemTime(Date.now() + 2000)
    const { result } = await refresh(harness)

    expect(result).toStrictEqual(expect.objectContaining({ provider: 'oidc' }))
    expect(interceptor.requests).toHaveLength(2)
  })

  it('keep returning an unexpired session during the pause', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const harness = createHarness({ requestTimeout: 50 })
    const persistentSession = await seedSession(harness, {}, inSeconds(120))
    let answer: TokenAnswer = hang
    const interceptor = interceptFetch([tokenRoute(async (request) => await answer(request))])

    await expect(getSession(harness)).resolves.toMatchObject({ provider: 'oidc' })
    await expect(getSession(harness)).resolves.toMatchObject({ provider: 'oidc' })

    expect(interceptor.requests).toHaveLength(1)
    expectSessionKept(harness, persistentSession)

    answer = refreshedTokens
    vi.setSystemTime(Date.now() + 31_000)
    await getSession(harness)

    expect(interceptor.requests).toHaveLength(2)
  })

  it('do not pause after an unanswered refresh that did not time out', async () => {
    const harness = createHarness({ requestTimeout: 50 })
    await seedSession(harness)
    const interceptor = interceptFetch([
      tokenRoute(() => new Response('unavailable', { status: 503 })),
    ])

    await refresh(harness)
    await refresh(harness)

    expect(interceptor.requests).toHaveLength(2)
  })
})
