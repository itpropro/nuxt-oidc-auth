import { describe, expect, it } from 'vitest'
import { HandlerHarness } from './handler-harness'

const providerConfig = {
  clientId: 'functional-client',
  clientSecret: 'functional-secret',
  authorizationUrl: 'https://identity.example.test/authorize',
  tokenUrl: 'https://identity.example.test/token',
  redirectUri: 'https://app.example.test/auth/oidc/callback',
  requiredProperties: ['clientId', 'clientSecret', 'authorizationUrl', 'tokenUrl', 'redirectUri'],
}

describe('login handler', () => {
  it.each(['redirectUri', 'redirect_uri'])(
    'keeps reserved %s server-controlled while forwarding safe parameters',
    async (reservedParameter) => {
      const harness = new HandlerHarness({
        runtimeConfig: {
          oidc: {
            providers: {
              oidc: {
                ...providerConfig,
                allowedClientAuthParameters: [reservedParameter, 'customParameter'],
              },
            },
          },
        },
      })
      const loginHandler = (await import('../../src/runtime/server/handler/login.get')).default
      const request = harness.createEvent({
        path: '/auth/oidc/login',
        query: {
          [reservedParameter]: 'https://attacker.example.test/callback',
          customParameter: 'preserved-value',
        },
      })

      await loginHandler(request.event)

      const authorizationUrl = new URL(request.response.location!)
      expect(request.response.status).toBe(302)
      expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(providerConfig.redirectUri)
      expect(authorizationUrl.searchParams.get('custom_parameter')).toBe('preserved-value')
      expect(request.response.location).not.toContain('attacker.example.test')
    },
  )
})
