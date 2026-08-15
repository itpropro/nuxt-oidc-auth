import { describe, expect, it } from 'vitest'
import { HandlerHarness } from './handler-harness'

function createRuntimeConfig(providerMaxAuthSessionAge?: number) {
  return {
    oidc: {
      session: {
        automaticRefresh: false,
        expirationCheck: false,
        maxAge: 3600,
        maxAuthSessionAge: 600,
      },
      providers: {
        oidc: {
          authorizationUrl: 'https://identity.example.test/authorize',
          clientId: 'functional-client',
          clientSecret: 'functional-secret',
          redirectUri: 'https://app.example.test/auth/oidc/callback',
          requiredProperties: [
            'clientId',
            'clientSecret',
            'authorizationUrl',
            'tokenUrl',
            'redirectUri',
          ],
          tokenUrl: 'https://identity.example.test/token',
          ...(providerMaxAuthSessionAge !== undefined && {
            sessionConfiguration: { maxAuthSessionAge: providerMaxAuthSessionAge },
          }),
        },
      },
    },
  }
}

describe('authentication session duration', () => {
  it.each([
    { expected: 600, name: 'global duration', provider: undefined },
    { expected: 120, name: 'provider duration', provider: 120 },
  ])('uses $name for login and callback', async ({ expected, provider }) => {
    const loginHarness = new HandlerHarness({
      runtimeConfig: createRuntimeConfig(provider),
    })
    const loginHandler = (await import('../../src/runtime/server/handler/login.get')).default
    await loginHandler(loginHarness.createEvent({ path: '/auth/oidc/login' }).event)
    expect(loginHarness.inspectSession('oidc')?.maxAge).toBe(expected)

    const callbackHarness = new HandlerHarness({
      runtimeConfig: createRuntimeConfig(provider),
    })
    const callbackHandler = (await import('../../src/runtime/server/handler/callback')).default
    await callbackHandler(callbackHarness.createEvent({ path: '/auth/oidc/callback' }).event)
    expect(callbackHarness.inspectSession('oidc')?.maxAge).toBe(expected)
  })
})
