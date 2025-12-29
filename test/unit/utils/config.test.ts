/**
 * Configuration Utility Tests
 *
 * Tests for configuration merging behavior using defu.
 * These tests verify the behavior of the defu library which is used
 * throughout the module for configuration merging.
 */

import { defu } from 'defu'
import { describe, expect, it } from 'vitest'

function parseBoolean(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

describe('configuration Utilities', () => {
  describe('configuration merging', () => {
    it('should merge simple objects', () => {
      const defaults = { a: 1, b: 2 }
      const overrides = { b: 3, c: 4 }

      const result = defu(overrides, defaults)

      expect(result).toEqual({ a: 1, b: 3, c: 4 })
    })

    it('should preserve undefined values from defaults', () => {
      const defaults = { a: 1, b: undefined }
      const overrides = { c: 3 }

      const result = defu(overrides, defaults)

      expect(result.a).toBe(1)
      expect(result.b).toBeUndefined()
      expect(result.c).toBe(3)
    })

    it('should merge nested objects', () => {
      const defaults = {
        session: {
          maxAge: 3600,
          secure: true,
        },
        provider: 'oidc',
      }

      const overrides = {
        session: {
          maxAge: 7200,
        },
      }

      const result = defu(overrides, defaults)

      expect(result.session.maxAge).toBe(7200)
      expect(result.session.secure).toBe(true)
      expect(result.provider).toBe('oidc')
    })

    it('should handle arrays correctly', () => {
      const defaults = {
        scopes: ['openid', 'profile'],
      }

      const overrides = {
        scopes: ['openid', 'email'],
      }

      const result = defu(overrides, defaults)

      expect(result.scopes).toEqual(['openid', 'email', 'openid', 'profile'])
    })

    it('should handle null values', () => {
      const defaults = { a: 1, b: 2 }
      const overrides = { a: null }

      const result = defu(overrides, defaults)

      expect(result.a).toBe(1)
      expect(result.b).toBe(2)
    })
  })

  describe('provider configuration validation patterns', () => {
    it('should validate required provider fields', () => {
      const providerConfig = {
        clientId: 'test-client',
        clientSecret: 'test-secret',
        baseUrl: 'https://example.com',
      }

      const requiredFields = ['clientId', 'clientSecret', 'baseUrl']
      const missingFields = requiredFields.filter(
        field => !(field in providerConfig) || !providerConfig[field as keyof typeof providerConfig],
      )

      expect(missingFields).toHaveLength(0)
    })

    it('should detect missing required fields', () => {
      const incompleteConfig = {
        clientId: 'test-client',
        baseUrl: 'https://example.com',
      }

      const requiredFields = ['clientId', 'clientSecret', 'baseUrl']
      const missingFields = requiredFields.filter(
        field => !(field in incompleteConfig),
      )

      expect(missingFields).toContain('clientSecret')
    })

    it('should validate URL format using URL constructor', () => {
      const validUrls = ['https://example.com', 'http://localhost:8080']
      const invalidUrls = ['not-a-url', '']

      for (const url of validUrls) {
        expect(() => new URL(url)).not.toThrow()
      }

      for (const url of invalidUrls) {
        expect(() => new URL(url)).toThrow()
      }
    })

    it('should validate scope arrays', () => {
      const validScopes = ['openid', 'profile']
      const emptyScopes: string[] = []
      const invalidScopes = ['openid', '']

      expect(Array.isArray(validScopes) && validScopes.length > 0).toBe(true)
      expect(validScopes.every(s => typeof s === 'string' && s.length > 0)).toBe(true)

      expect(emptyScopes.length > 0).toBe(false)
      expect(invalidScopes.every(s => s.length > 0)).toBe(false)
    })
  })

  describe('environment variable parsing patterns', () => {
    it('should parse boolean string values', () => {
      expect(parseBoolean('true')).toBe(true)
      expect(parseBoolean('1')).toBe(true)
      expect(parseBoolean('false')).toBe(false)
      expect(parseBoolean('0')).toBe(false)
      expect(parseBoolean(undefined)).toBe(false)
    })

    it('should parse numeric environment variables', () => {
      expect(Number.parseInt('3600', 10)).toBe(3600)
      expect(Number.parseInt('0', 10)).toBe(0)
      expect(Number.isNaN(Number.parseInt('invalid', 10))).toBe(true)
    })

    it('should parse array environment variables', () => {
      const value = 'openid,profile,email'
      const result = value.split(',').map(s => s.trim()).filter(Boolean)

      expect(result).toEqual(['openid', 'profile', 'email'])
    })

    it('should handle spaced array values', () => {
      const value = '  spaced , items  '
      const result = value.split(',').map(s => s.trim()).filter(Boolean)

      expect(result).toEqual(['spaced', 'items'])
    })
  })
})
