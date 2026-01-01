import { fileURLToPath } from 'node:url'
import { $fetch } from '@nuxt/test-utils'
import { url } from '@nuxt/test-utils/e2e'
import { expect, test } from '@nuxt/test-utils/playwright'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../../fixtures/devModeApp', import.meta.url)),
    dev: true,
  },
})

test.describe('Dev Mode Discovery Endpoint', () => {
  test('exposes discovery endpoint', async () => {
    const response = await fetch(url('/auth/dev/.well-known/openid-configuration'))
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.issuer).toBe('test-issuer')
    expect(data.jwks_uri).toContain('/auth/dev/.well-known/jwks.json')
  })

  test('discovery jwks_uri is resolvable', async () => {
    const discovery = await $fetch(url('/auth/dev/.well-known/openid-configuration')) as { jwks_uri: string }
    const jwksUrl = new URL(discovery.jwks_uri)

    const response = await fetch(url(jwksUrl.pathname))
    expect(response.status).toBe(200)
  })
})

test.describe('Dev Mode JWKS Endpoint', () => {
  test('exposes JWKS endpoint with valid RSA key', async () => {
    const response = await fetch(url('/auth/dev/.well-known/jwks.json'))
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.keys).toBeInstanceOf(Array)
    expect(data.keys.length).toBeGreaterThan(0)

    const key = data.keys[0]
    expect(key.kty).toBe('RSA')
    expect(key.alg).toBe('RS256')
    expect(key.use).toBe('sig')
    expect(key.kid).toBeDefined()
    expect(key.n).toBeDefined()
    expect(key.e).toBeDefined()
  })
})

function extractSessionCookie(response: Response): string {
  const cookies = response.headers.getSetCookie()
  const sessionCookie = cookies.find(c => c.startsWith('nuxt-oidc-auth='))
  return sessionCookie?.split(';')[0] || ''
}

test.describe('Dev Mode Token Generation', () => {
  test('dev login creates session and redirects', async () => {
    const loginResponse = await fetch(url('/auth/dev/login'), { redirect: 'manual' })
    expect(loginResponse.status).toBe(302)
    expect(loginResponse.headers.get('location')).toBe('/')

    const cookie = extractSessionCookie(loginResponse)
    expect(cookie).toContain('nuxt-oidc-auth=')
  })

  test('JWKS keys have consistent kid across requests', async () => {
    const jwks1 = await $fetch(url('/auth/dev/.well-known/jwks.json')) as { keys: Array<{ kid: string }> }
    const jwks2 = await $fetch(url('/auth/dev/.well-known/jwks.json')) as { keys: Array<{ kid: string }> }

    expect(jwks1.keys).toHaveLength(1)
    expect(jwks2.keys).toHaveLength(1)
    expect(jwks1.keys[0]!.kid).toBe(jwks2.keys[0]!.kid)
  })
})
