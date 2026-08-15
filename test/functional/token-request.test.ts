import type { OidcProviderConfig } from '../../src/runtime/server/utils/provider'
import type * as OidcUtils from '../../src/runtime/server/utils/oidc'
import { Buffer } from 'node:buffer'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRs256Fixture, HandlerHarness, interceptFetch } from './handler-harness'

type TokenRequestType = NonNullable<OidcProviderConfig['tokenRequestType']>

const tokenUrl = 'https://identity.example.test/token'
const specialClientId = 'client+/%=&-clïent'
const specialClientSecret = 'secret +/%=&-sëcret'
const specialValue = 'value+/%=&-välue'
const redirectUri = `https://app.example.test/auth/oidc/callback?return=${encodeURIComponent(specialValue)}`
const encodedClientSecrets = [
  specialClientSecret,
  encodeURIComponent(specialClientSecret),
  new URLSearchParams({ value: specialClientSecret }).toString().slice('value='.length),
]
expect(new Set(encodedClientSecrets)).toHaveLength(3)
let accessToken: string

const testLogger = vi.hoisted(() => ({
  error: vi.fn<(...args: unknown[]) => void>(),
  info: vi.fn<(...args: unknown[]) => void>(),
  warn: vi.fn<(...args: unknown[]) => void>(),
}))

vi.mock('../../src/runtime/server/utils/oidc', async (importOriginal) => {
  const actual = await importOriginal<typeof OidcUtils>()
  return { ...actual, useOidcLogger: () => testLogger }
})

beforeAll(async () => {
  const signingFixture = await createRs256Fixture()
  accessToken = await signingFixture.sign({ sub: 'user-1' })
})

beforeEach(() => {
  testLogger.error.mockClear()
  testLogger.info.mockClear()
  testLogger.warn.mockClear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function readTokenRequest(
  request: Request,
  requestType: TokenRequestType,
): Promise<Record<string, string>> {
  if (requestType === 'json') {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('Expected a JSON object token request')
    }
    return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, String(value)]))
  }

  if (requestType === 'form-urlencoded') {
    return Object.fromEntries(new URLSearchParams(await request.text()))
  }

  const body = await request.formData()
  return Object.fromEntries(
    [...body.entries()].map(([key, value]) => [
      key,
      typeof value === 'string' ? value : value.name,
    ]),
  )
}

function expectContentType(request: Request, requestType: TokenRequestType): void {
  const contentType = request.headers.get('content-type')
  if (requestType === 'json') {
    expect(contentType).toContain('application/json')
  } else if (requestType === 'form-urlencoded') {
    expect(contentType).toContain('application/x-www-form-urlencoded')
  } else {
    expect(contentType).toContain('multipart/form-data')
  }
}

function expectClientSecretRedacted(message: string): void {
  expect(message).toContain('[REDACTED]')
  for (const clientSecret of encodedClientSecrets) {
    expect(message).not.toContain(clientSecret)
  }
}

function createCallbackRuntimeConfig(
  tokenRequestType: TokenRequestType,
  authenticationScheme: OidcProviderConfig['authenticationScheme'] = 'body',
) {
  return {
    oidc: {
      session: {
        maxAge: 3600,
        automaticRefresh: false,
        expirationCheck: false,
      },
      providers: {
        oidc: {
          authenticationScheme,
          clientId: specialClientId,
          clientSecret: specialClientSecret,
          authorizationUrl: 'https://identity.example.test/authorize',
          tokenUrl,
          redirectUri,
          scope: ['openid', specialValue],
          scopeInTokenRequest: true,
          tokenRequestType,
          userInfoUrl: '',
          validateAccessToken: false,
          validateIdToken: false,
          additionalTokenParameters: { customParameter: specialValue },
          requiredProperties: [
            'clientId',
            'clientSecret',
            'authorizationUrl',
            'tokenUrl',
            'redirectUri',
          ],
        },
      },
    },
  }
}

function createRefreshConfig(
  tokenRequestType: TokenRequestType,
  authenticationScheme: OidcProviderConfig['authenticationScheme'] = 'body',
): OidcProviderConfig {
  return {
    authenticationScheme,
    authorizationUrl: 'https://identity.example.test/authorize',
    clientId: specialClientId,
    clientSecret: specialClientSecret,
    grantType: 'authorization_code',
    redirectUri,
    requiredProperties: ['clientId', 'clientSecret', 'tokenUrl'],
    responseMode: 'query',
    responseType: 'code',
    scope: ['openid', specialValue, 'offline_access'],
    scopeInTokenRequest: true,
    excludeOfflineScopeFromTokenRequest: true,
    tokenRequestType,
    tokenUrl,
  }
}

describe('token request transport encoding', () => {
  it.each([
    [null, 'null'],
    [undefined, 'undefined'],
    [false, 'false'],
    [42, '42'],
    ['request failed', 'request failed'],
    [new Error('request failed'), 'request failed'],
  ])('formats token request errors without throwing', async (error, expected) => {
    const { formatTokenRequestError } = await import('../../src/runtime/server/utils/oidc')

    expect(formatTokenRequestError(error, '')).toBe(expected)
  })

  it('formats structured token request errors', async () => {
    const { formatTokenRequestError } = await import('../../src/runtime/server/utils/oidc')

    expect(
      formatTokenRequestError(
        { data: { error: 'invalid_client', error_description: 'Credentials rejected' } },
        '',
      ),
    ).toBe('invalid_client: Credentials rejected')
  })

  it('uses a stable fallback for inaccessible thrown values', async () => {
    const { formatTokenRequestError } = await import('../../src/runtime/server/utils/oidc')
    const inaccessibleError = new Proxy(
      {},
      {
        has: () => {
          throw new Error('inaccessible')
        },
      },
    )

    expect(formatTokenRequestError(inaccessibleError, '')).toBe('Unknown token request error')
  })

  it('coerces malformed Error messages before redaction', async () => {
    const { formatTokenRequestError } = await import('../../src/runtime/server/utils/oidc')
    const malformedError = new Error('placeholder')
    Object.defineProperty(malformedError, 'message', {
      value: { toString: () => specialClientSecret },
    })

    expect(formatTokenRequestError(malformedError, specialClientSecret)).toBe('[REDACTED]')
  })

  it('redacts raw, percent-encoded, and form-encoded client secrets', async () => {
    const { formatTokenRequestError } = await import('../../src/runtime/server/utils/oidc')

    expectClientSecretRedacted(
      formatTokenRequestError(
        { data: { error: 'invalid_client', error_description: encodedClientSecrets.join(' | ') } },
        specialClientSecret,
      ),
    )
  })

  it('redacts form-encoded malformed client secrets', async () => {
    const { formatTokenRequestError } = await import('../../src/runtime/server/utils/oidc')
    const malformedSecret = '\uD800'
    const formEncodedSecret = new URLSearchParams({ value: malformedSecret })
      .toString()
      .slice('value='.length)
    const message = formatTokenRequestError(
      { data: { error: 'invalid_client', error_description: formEncodedSecret } },
      malformedSecret,
    )

    expect(message).toContain('[REDACTED]')
    expect(message).not.toContain(formEncodedSecret)
  })

  it('redacts form-normalized malformed client secrets', async () => {
    const { formatTokenRequestError } = await import('../../src/runtime/server/utils/oidc')
    const malformedSecret = '\uD800'
    const normalizedSecret = new URLSearchParams({ value: malformedSecret }).get('value')
    const message = formatTokenRequestError(
      { data: { error: 'invalid_client', error_description: normalizedSecret } },
      malformedSecret,
    )

    expect(message).toBe('invalid_client: [REDACTED]')
  })

  it('redacts overlapping client-secret encodings longest first', async () => {
    const { formatTokenRequestError } = await import('../../src/runtime/server/utils/oidc')
    const message = formatTokenRequestError(
      { data: { error: 'invalid_client', error_description: '% | %25' } },
      '%',
    )

    expect(message).toBe('invalid_client: [REDACTED] | [REDACTED]')
  })

  it('redacts mixed-case percent-encoded client secrets', async () => {
    const { formatTokenRequestError } = await import('../../src/runtime/server/utils/oidc')
    const message = formatTokenRequestError(
      { data: { error: 'invalid_client', error_description: '%2f%c3%a9' } },
      '/é',
    )

    expect(message).toBe('invalid_client: [REDACTED]')
  })

  it.each<TokenRequestType>(['form', 'form-urlencoded', 'json'])(
    'preserves callback values for %s requests',
    async (tokenRequestType) => {
      const harness = new HandlerHarness({
        runtimeConfig: createCallbackRuntimeConfig(tokenRequestType),
      })
      harness.cookieJar.seedSession('oidc', {
        state: 'functional-state',
        codeVerifier: specialValue,
        redirect: redirectUri,
      })
      const interceptor = interceptFetch([
        {
          method: 'POST',
          url: tokenUrl,
          respond: () =>
            Response.json({ access_token: accessToken, token_type: 'Bearer', expires_in: '300' }),
        },
      ])
      const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
      const event = harness.createEvent({
        path: '/auth/oidc/callback',
        query: { code: specialValue, state: 'functional-state' },
      })

      await callbackHandler(event.event)

      expect(harness.inspectSession('nuxt-oidc-auth')?.data).toMatchObject({ provider: 'oidc' })
      expect(interceptor.requests).toHaveLength(1)
      const request = interceptor.requests[0]!
      expectContentType(request, tokenRequestType)
      await expect(readTokenRequest(request, tokenRequestType)).resolves.toMatchObject({
        client_id: specialClientId,
        client_secret: specialClientSecret,
        code: specialValue,
        code_verifier: specialValue,
        custom_parameter: specialValue,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        scope: `openid ${specialValue}`,
      })
    },
  )

  it('base64-encodes original callback credentials for header authentication', async () => {
    const harness = new HandlerHarness({
      runtimeConfig: createCallbackRuntimeConfig('form-urlencoded', 'header'),
    })
    harness.cookieJar.seedSession('oidc', {
      state: 'functional-state',
      codeVerifier: specialValue,
      redirect: redirectUri,
    })
    const interceptor = interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({ access_token: accessToken, token_type: 'Bearer', expires_in: '300' }),
      },
    ])
    const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
    const event = harness.createEvent({
      path: '/auth/oidc/callback',
      query: { code: specialValue, state: 'functional-state' },
    })

    await callbackHandler(event.event)

    const request = interceptor.requests[0]!
    const authorization = request.headers.get('authorization')
    expect(authorization).toMatch(/^Basic /)
    expect(Buffer.from(authorization!.slice('Basic '.length), 'base64').toString('utf8')).toBe(
      `${specialClientId}:${specialClientSecret}`,
    )
    expect((await readTokenRequest(request, 'form-urlencoded')).client_secret).toBeUndefined()
  })

  it('redacts reflected client secrets from callback errors', async () => {
    const harness = new HandlerHarness({
      runtimeConfig: createCallbackRuntimeConfig('form-urlencoded'),
    })
    harness.cookieJar.seedSession('oidc', {
      state: 'functional-state',
      codeVerifier: specialValue,
      redirect: redirectUri,
    })
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json(
            {
              error: 'invalid_client',
              error_description: encodedClientSecrets.join(' | '),
            },
            { status: 401 },
          ),
      },
    ])
    const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
    const event = harness.createEvent({
      path: '/auth/oidc/callback',
      query: { code: specialValue, state: 'functional-state' },
    })

    await callbackHandler(event.event)

    expectClientSecretRedacted(testLogger.error.mock.calls.flat().map(String).join(' '))
    expect(harness.inspectSession('nuxt-oidc-auth')?.data).toEqual({})
  })

  it.each<TokenRequestType>(['form', 'form-urlencoded', 'json'])(
    'preserves refresh values for %s requests',
    async (tokenRequestType) => {
      const { refreshAccessToken } = await import('../../src/runtime/server/utils/oidc')
      const interceptor = interceptFetch([
        {
          method: 'POST',
          url: tokenUrl,
          respond: () =>
            Response.json({ access_token: accessToken, token_type: 'Bearer', expires_in: '300' }),
        },
      ])

      await refreshAccessToken(specialValue, createRefreshConfig(tokenRequestType))

      expect(interceptor.requests).toHaveLength(1)
      const request = interceptor.requests[0]!
      expectContentType(request, tokenRequestType)
      await expect(readTokenRequest(request, tokenRequestType)).resolves.toMatchObject({
        client_id: specialClientId,
        client_secret: specialClientSecret,
        grant_type: 'refresh_token',
        refresh_token: specialValue,
        scope: `openid ${specialValue}`,
      })
    },
  )

  it('base64-encodes original refresh credentials for header authentication', async () => {
    const { refreshAccessToken } = await import('../../src/runtime/server/utils/oidc')
    const interceptor = interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json({ access_token: accessToken, token_type: 'Bearer', expires_in: '300' }),
      },
    ])

    await refreshAccessToken(specialValue, createRefreshConfig('form-urlencoded', 'header'))

    const request = interceptor.requests[0]!
    const authorization = request.headers.get('authorization')
    expect(authorization).toMatch(/^Basic /)
    expect(Buffer.from(authorization!.slice('Basic '.length), 'base64').toString('utf8')).toBe(
      `${specialClientId}:${specialClientSecret}`,
    )
    expect((await readTokenRequest(request, 'form-urlencoded')).client_secret).toBeUndefined()
  })

  it('redacts reflected client secrets from refresh errors', async () => {
    const { refreshAccessToken } = await import('../../src/runtime/server/utils/oidc')
    interceptFetch([
      {
        method: 'POST',
        url: tokenUrl,
        respond: () =>
          Response.json(
            {
              error: 'invalid_client',
              error_description: encodedClientSecrets.join(' | '),
            },
            { status: 401 },
          ),
      },
    ])

    const requestError: unknown = await refreshAccessToken(
      specialValue,
      createRefreshConfig('form-urlencoded'),
    ).catch((error: unknown) => error)

    expect(requestError).toBeInstanceOf(Error)
    expectClientSecretRedacted(String(requestError))
  })
})
