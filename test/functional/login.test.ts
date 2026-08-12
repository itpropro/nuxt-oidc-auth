import { describe, expect, it } from 'vitest'
import { HandlerHarness } from './handler-harness'

const providerConfig = {
  clientId: 'functional-client',
  clientSecret: 'functional-secret',
  authorizationUrl: 'https://identity.example.test/authorize',
  tokenUrl: 'https://identity.example.test/token',
  redirectUri: 'https://app.example.test/auth/oidc/callback',
  responseType: 'code',
  pkce: true,
  state: true,
  nonce: true,
  scope: ['openid', 'profile'],
  requiredProperties: ['clientId', 'clientSecret', 'authorizationUrl', 'tokenUrl', 'redirectUri'],
}

const attackerValue = 'attacker-controlled-value'
const customParameter = 'customProviderParameter'
const customValue = 'preserved-value'
const overrideCases = [
  {
    style: 'camelCase',
    parameters: [
      'redirectUri',
      'clientId',
      'responseType',
      'codeChallenge',
      'state',
      'scope',
      'nonce',
    ],
  },
  {
    style: 'snake_case',
    parameters: [
      'redirect_uri',
      'client_id',
      'response_type',
      'code_challenge',
      'state',
      'scope',
      'nonce',
    ],
  },
]

describe('login handler', () => {
  it.each(overrideCases)(
    'keeps $style reserved authorization parameters server-controlled',
    async ({ parameters }) => {
      const harness = new HandlerHarness({
        runtimeConfig: {
          oidc: {
            providers: {
              oidc: {
                ...providerConfig,
                allowedClientAuthParameters: [...parameters, customParameter],
              },
            },
          },
        },
      })
      const loginHandler = (await import('../../src/runtime/server/handler/login.get')).default
      const request = harness.createEvent({
        path: '/auth/oidc/login',
        query: {
          ...Object.fromEntries(parameters.map((parameter) => [parameter, attackerValue])),
          [customParameter]: customValue,
        },
      })

      await loginHandler(request.event)

      const location = request.response.location
      expect(location).toBeDefined()
      if (!location) throw new Error('Login handler did not return a redirect Location')

      const authorizationUrl = new URL(location)
      const authSession = harness.inspectSession('oidc')
      expect(request.response.status).toBe(302)
      expect(authorizationUrl.searchParams.get('client_id')).toBe(providerConfig.clientId)
      expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(providerConfig.redirectUri)
      expect(authorizationUrl.searchParams.get('response_type')).toBe(providerConfig.responseType)
      expect(authorizationUrl.searchParams.get('scope')).toBe(providerConfig.scope.join(' '))
      expect(authorizationUrl.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/)
      expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256')
      expect(authSession?.data).toMatchObject({
        state: expect.any(String),
        nonce: expect.any(String),
      })
      expect(authorizationUrl.searchParams.get('state')).toBe(authSession?.data.state)
      expect(authorizationUrl.searchParams.get('nonce')).toBe(authSession?.data.nonce)
      expect(authorizationUrl.searchParams.get('custom_provider_parameter')).toBe(customValue)
      expect(location).not.toContain(attackerValue)
    },
  )
})
