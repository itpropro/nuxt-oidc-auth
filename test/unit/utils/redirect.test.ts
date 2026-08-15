import { describe, expect, it, vi } from 'vitest'
import {
  resolveCallbackRedirectUrl,
  sanitizeCallbackRedirectUrl,
  withAppBase,
} from '../../../src/runtime/server/utils/redirect'

vi.mock('#imports', () => ({
  useRuntimeConfig: () => ({ app: { baseURL: '/' } }),
}))

describe('redirect utils', () => {
  describe('sanitizeCallbackRedirectUrl', () => {
    it('accepts local path redirects', () => {
      expect(sanitizeCallbackRedirectUrl('/protected')).toBe('/protected')
      expect(sanitizeCallbackRedirectUrl('/protected?tab=1#section')).toBe(
        '/protected?tab=1#section',
      )
    })

    it('rejects non-local redirects', () => {
      expect(sanitizeCallbackRedirectUrl('https://example.com')).toBeUndefined()
      expect(sanitizeCallbackRedirectUrl('javascript:alert(1)')).toBeUndefined()
      expect(sanitizeCallbackRedirectUrl('//example.com')).toBeUndefined()
      expect(sanitizeCallbackRedirectUrl('/\\example.com/path')).toBeUndefined()
      expect(sanitizeCallbackRedirectUrl('/protected\\path')).toBeUndefined()
      expect(sanitizeCallbackRedirectUrl('/\t/example.com/path')).toBeUndefined()
      expect(sanitizeCallbackRedirectUrl('/\n/example.com/path')).toBeUndefined()
      expect(sanitizeCallbackRedirectUrl('/\r/example.com/path')).toBeUndefined()
      expect(sanitizeCallbackRedirectUrl('protected')).toBeUndefined()
    })
  })

  describe('withAppBase', () => {
    it('applies a custom base once and preserves root-base behavior', () => {
      expect(withAppBase('/', '/prefix/')).toBe('/prefix/')
      expect(withAppBase('/account?tab=security', '/prefix/')).toBe('/prefix/account?tab=security')
      expect(withAppBase('/prefix/account', '/prefix/')).toBe('/prefix/account')
      expect(withAppBase('/', '/')).toBe('/')
      expect(withAppBase('/account', '/')).toBe('/account')
    })
  })

  describe('resolveCallbackRedirectUrl', () => {
    it('uses configured callback redirect when explicitly set', () => {
      expect(
        resolveCallbackRedirectUrl({
          configuredCallbackRedirectUrl: '/configured',
          hasConfiguredCallbackRedirectUrl: true,
          sessionCallbackRedirectUrl: '/protected',
        }),
      ).toBe('/configured')
    })

    it('keeps explicit root callback redirect over session redirect', () => {
      expect(
        resolveCallbackRedirectUrl({
          configuredCallbackRedirectUrl: '/',
          hasConfiguredCallbackRedirectUrl: true,
          sessionCallbackRedirectUrl: '/protected',
        }),
      ).toBe('/')
    })

    it('uses session callback redirect when no configured callback redirect is set', () => {
      expect(
        resolveCallbackRedirectUrl({
          configuredCallbackRedirectUrl: '/',
          hasConfiguredCallbackRedirectUrl: false,
          sessionCallbackRedirectUrl: '/protected?foo=bar',
        }),
      ).toBe('/protected?foo=bar')
    })

    it('falls back to configured redirect when session callback redirect is invalid', () => {
      expect(
        resolveCallbackRedirectUrl({
          configuredCallbackRedirectUrl: '/',
          hasConfiguredCallbackRedirectUrl: false,
          sessionCallbackRedirectUrl: 'https://example.com',
        }),
      ).toBe('/')
    })

    it('falls back to root when no redirect is available', () => {
      expect(
        resolveCallbackRedirectUrl({
          hasConfiguredCallbackRedirectUrl: false,
        }),
      ).toBe('/')
    })

    it('rejects an explicitly configured external redirect', () => {
      expect(
        resolveCallbackRedirectUrl({
          configuredCallbackRedirectUrl: 'https://example.com',
          hasConfiguredCallbackRedirectUrl: true,
          sessionCallbackRedirectUrl: '/protected',
        }),
      ).toBe('/')
    })
  })
})
