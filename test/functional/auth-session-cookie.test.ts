import type { SessionConfig } from 'h3'
import { describe, expect, it } from 'vitest'

import type { AuthSessionConfig } from '../../src/runtime/types'
import { HandlerHarness } from './handler-harness'

function createRuntimeConfig(cookie: AuthSessionConfig['cookie']) {
  return {
    oidc: {
      session: {
        automaticRefresh: false,
        expirationCheck: false,
        maxAge: 3600,
        maxAuthSessionAge: 300,
        ...(cookie !== undefined && { cookie }),
      },
      providers: {
        oidc: {
          authorizationUrl: 'https://identity.example.test/authorize',
          clientId: 'functional-client',
          clientSecret: 'functional-secret',
          redirectUri: 'https://app.example.test/auth/oidc/callback',
          tokenValidationMode: 'legacy',
          requiredProperties: [
            'clientId',
            'clientSecret',
            'authorizationUrl',
            'tokenUrl',
            'redirectUri',
          ],
          tokenUrl: 'https://identity.example.test/token',
        },
      },
    },
  }
}

describe('authentication session cookie', () => {
  it.each([
    { cookie: undefined, expected: {}, name: 'keeps the h3 defaults without cookie overrides' },
    {
      cookie: { sameSite: 'lax' },
      expected: {},
      name: 'keeps the h3 defaults without a secure flag',
    },
    {
      cookie: { sameSite: 'lax', secure: false },
      expected: { secure: false },
      name: 'applies an explicit insecure flag',
    },
    {
      cookie: { secure: true },
      expected: { secure: true },
      name: 'applies an explicit secure flag',
    },
    {
      cookie: { sameSite: 'strict', secure: false },
      expected: { secure: false },
      name: 'leaves sameSite to the browser',
    },
  ] satisfies {
    cookie: AuthSessionConfig['cookie']
    expected: SessionConfig['cookie']
    name: string
  }[])('$name for login and callback', async ({ cookie, expected }) => {
    const loginHarness = new HandlerHarness({ runtimeConfig: createRuntimeConfig(cookie) })
    const loginHandler = (await import('../../src/runtime/server/handler/login.get')).default
    await loginHandler(loginHarness.createEvent({ path: '/auth/oidc/login' }).event)
    // No overrides and an empty object both leave the h3 cookie defaults in effect.
    expect(loginHarness.inspectSession('oidc')?.cookie ?? {}).toStrictEqual(expected)

    const callbackHarness = new HandlerHarness({ runtimeConfig: createRuntimeConfig(cookie) })
    const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
    await callbackHandler(callbackHarness.createEvent({ path: '/auth/oidc/callback' }).event)
    expect(callbackHarness.inspectSession('oidc')?.cookie ?? {}).toStrictEqual(expected)
  })
})
