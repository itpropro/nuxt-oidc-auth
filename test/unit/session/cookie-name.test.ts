/**
 * Session Cookie Name Configuration Tests
 *
 * tests for GitHub issue #75: Custom cookie name for the session
 * https://github.com/itpropro/nuxt-oidc-auth/issues/75
 */

import { defu } from 'defu'
import { describe, expect, it } from 'vitest'

const DEFAULT_SESSION_NAME = 'nuxt-oidc-auth'

interface SessionConfigWithCookieName {
  cookieName?: string
  automaticRefresh?: boolean
  expirationCheck?: boolean
  maxAge?: number
  cookie?: {
    sameSite?: true | false | 'lax' | 'strict' | 'none' | undefined
    secure?: boolean | undefined
  }
}

function resolveSessionName(config: SessionConfigWithCookieName | undefined): string {
  const customName = config?.cookieName
  // Use default if cookieName is undefined, null, or empty string
  return customName && customName.length > 0 ? customName : DEFAULT_SESSION_NAME
}

function mergeSessionConfig(
  envPassword: string,
  runtimeConfig: SessionConfigWithCookieName | undefined,
): { name: string; password: string } & SessionConfigWithCookieName {
  const sessionName = resolveSessionName(runtimeConfig)
  return defu({ password: envPassword, name: sessionName }, runtimeConfig ?? {})
}

describe('session Cookie Name Configuration', () => {
  describe('default behavior', () => {
    it('should use default cookie name when no custom name is provided', () => {
      const sessionName = resolveSessionName(undefined)

      expect(sessionName).toBe(DEFAULT_SESSION_NAME)
    })

    it('should fall back to default when cookieName is empty string', () => {
      const sessionName = resolveSessionName({ cookieName: '' })

      expect(sessionName).toBe(DEFAULT_SESSION_NAME)
    })
  })

  describe('custom cookie name', () => {
    it('should use custom cookie name when provided', () => {
      const customName = 'my-app-session'
      const sessionName = resolveSessionName({ cookieName: customName })

      expect(sessionName).toBe(customName)
    })
  })

  describe('session configuration merge', () => {
    it('should include custom cookie name in merged config while preserving other settings', () => {
      const config = mergeSessionConfig('secret-password', {
        cookieName: 'my-custom-cookie',
        automaticRefresh: true,
        expirationCheck: true,
        maxAge: 86400,
        cookie: {
          sameSite: 'strict',
          secure: true,
        },
      })

      expect(config.name).toBe('my-custom-cookie')
      expect(config.password).toBe('secret-password')
      expect(config.automaticRefresh).toBe(true)
      expect(config.expirationCheck).toBe(true)
      expect(config.maxAge).toBe(86400)
      expect(config.cookie?.sameSite).toBe('strict')
      expect(config.cookie?.secure).toBe(true)
    })
  })

  describe('multiple services scenario (issue #75 use case)', () => {
    it('should allow different services to have unique cookie names to avoid conflicts', () => {
      // Scenario: Multiple Nuxt apps proxied under same host
      const configs = [
        { cookieName: 'service1-auth' },
        { cookieName: 'service2-auth' },
        { cookieName: 'service3-auth' },
      ]

      const names = configs.map(c => resolveSessionName(c))

      expect(names).toEqual(['service1-auth', 'service2-auth', 'service3-auth'])

      expect(new Set(names).size).toBe(names.length)
    })

    it('should not conflict with default when one service uses custom name', () => {
      const defaultServiceConfig: SessionConfigWithCookieName = {}
      const customServiceConfig: SessionConfigWithCookieName = { cookieName: 'custom-service-auth' }

      const defaultName = resolveSessionName(defaultServiceConfig)
      const customName = resolveSessionName(customServiceConfig)

      expect(defaultName).toBe(DEFAULT_SESSION_NAME)
      expect(customName).toBe('custom-service-auth')
      expect(defaultName).not.toBe(customName)
    })
  })
})
