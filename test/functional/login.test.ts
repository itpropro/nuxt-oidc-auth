import { describe, expect, it } from 'vitest'

import { HandlerHarness } from './handler-harness'

const codeChallengePattern = /^[A-Za-z0-9_-]{43}$/u

const providerConfig = {
  clientId: 'functional-client',
  clientSecret: 'functional-secret',
  authorizationUrl: 'https://identity.example.test/authorize',
  tokenUrl: 'https://identity.example.test/token',
  redirectUri: 'https://app.example.test/auth/oidc/callback',
  responseType: 'code',
  responseMode: 'query',
  prompt: ['login'],
  pkce: true,
  state: true,
  nonce: false,
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
      'responseMode',
      'codeChallenge',
      'codeChallengeMethod',
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
      'response_mode',
      'code_challenge',
      'code_challenge_method',
      'state',
      'scope',
      'nonce',
    ],
  },
]

async function login(
  provider: string,
  config: Record<string, unknown>,
  query: Record<string, string | string[]>,
) {
  const harness = new HandlerHarness({
    runtimeConfig: { oidc: { providers: { [provider]: config } } },
  })
  const loginHandler = (await import('../../src/runtime/server/handler/login.get')).default
  const request = harness.createEvent({ path: `/auth/${provider}/login`, query })

  await loginHandler(request.event)

  const location = request.response.location
  if (location === undefined) {
    throw new Error('Login handler did not return a redirect Location')
  }
  return {
    status: request.response.status,
    prompts: new URL(location).searchParams.getAll('prompt'),
  }
}

const { prompt: _staticPrompt, ...noPromptConfig } = providerConfig
const promptAllowed = { ...noPromptConfig, allowedClientAuthParameters: ['prompt'] }

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
      if (location === undefined) {
        throw new Error('Login handler did not return a redirect Location')
      }

      const authorizationUrl = new URL(location)
      const authSession = harness.inspectSession('oidc')
      expect(request.response.status).toBe(302)
      expect(authorizationUrl.searchParams.get('client_id')).toBe(providerConfig.clientId)
      expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(providerConfig.redirectUri)
      expect(authorizationUrl.searchParams.get('response_type')).toBe(providerConfig.responseType)
      expect(authorizationUrl.searchParams.get('response_mode')).toBe(providerConfig.responseMode)
      expect(authorizationUrl.searchParams.get('prompt')).toBe(providerConfig.prompt.join(' '))
      expect(authorizationUrl.searchParams.get('scope')).toBe(providerConfig.scope.join(' '))
      expect(authorizationUrl.searchParams.get('code_challenge')).toMatch(codeChallengePattern)
      expect(authorizationUrl.searchParams.get('code_challenge_method')).toBe('S256')
      expect(authSession?.data['state']).toBeTypeOf('string')
      expect(authorizationUrl.searchParams.get('state')).toBe(authSession?.data['state'])
      expect(authorizationUrl.searchParams.has('nonce')).toBe(false)
      expect(authorizationUrl.searchParams.get('custom_provider_parameter')).toBe(customValue)
      expect(location).not.toContain(attackerValue)
    },
  )
})

describe('login handler client prompt', () => {
  it('forwards an allowlisted prompt for the Entra preset', async () => {
    const result = await login(
      'entra',
      {
        clientId: 'entra-client',
        clientSecret: 'entra-secret',
        authorizationUrl: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/tenant/oauth2/v2.0/token',
        redirectUri: 'https://app.example.test/auth/entra/callback',
        allowedClientAuthParameters: ['prompt'],
      },
      { prompt: 'select_account' },
    )

    expect(result).toStrictEqual({ status: 302, prompts: ['select_account'] })
  })

  it.each(['login', 'consent', 'none', 'create', 'login consent select_account'])(
    'forwards allowlisted prompt %j',
    async (prompt) => {
      await expect(login('oidc', promptAllowed, { prompt })).resolves.toStrictEqual({
        status: 302,
        prompts: [prompt],
      })
    },
  )

  it.each([
    ['unknown'],
    ['LOGIN'],
    ['login unknown'],
    ['none login'],
    ['create login'],
    [''],
    [' '],
    [['login', 'consent']],
  ])('drops invalid allowlisted prompt %j', async (prompt) => {
    await expect(login('oidc', promptAllowed, { prompt })).resolves.toStrictEqual({
      status: 302,
      prompts: [],
    })
  })

  it('validates allowlisted names that normalize to prompt', async () => {
    const config = { ...noPromptConfig, allowedClientAuthParameters: ['Prompt'] }

    await expect(login('oidc', config, { Prompt: 'unknown' })).resolves.toStrictEqual({
      status: 302,
      prompts: [],
    })
  })

  it.each([undefined, [], ['customProviderParameter']])(
    'ignores client prompts when the allowlist is %j',
    async (allowedClientAuthParameters) => {
      const query = { prompt: 'select_account' }

      await expect(
        login('oidc', { ...noPromptConfig, allowedClientAuthParameters }, query),
      ).resolves.toStrictEqual({ status: 302, prompts: [] })
      await expect(
        login('oidc', { ...providerConfig, allowedClientAuthParameters }, query),
      ).resolves.toStrictEqual({ status: 302, prompts: ['login'] })
    },
  )

  it('lets a valid client prompt override the configured prompt', async () => {
    const config = { ...providerConfig, allowedClientAuthParameters: ['prompt'] }

    await expect(login('oidc', config, { prompt: 'select_account' })).resolves.toStrictEqual({
      status: 302,
      prompts: ['select_account'],
    })
  })

  it.each([
    ['valid', ['prompt'], { prompt: 'select_account' }, 'select_account'],
    ['absent', ['prompt'], {}, 'consent'],
    ['disallowed', [], { prompt: 'select_account' }, 'consent'],
    ['rejected', ['prompt'], { prompt: 'unknown' }, 'consent'],
  ])(
    'resolves a %s client prompt against additionalAuthParameters',
    async (_case, allowedClientAuthParameters, query, expected) => {
      const config = {
        ...providerConfig,
        additionalAuthParameters: { prompt: 'consent' },
        allowedClientAuthParameters,
      }

      await expect(login('oidc', config, query)).resolves.toStrictEqual({
        status: 302,
        prompts: [expected],
      })
    },
  )
})
