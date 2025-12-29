/**
 * Session Data Unit Tests
 *
 * Tests for session data structures and helper functions.
 * Validates session creation, expiration logic, and data integrity.
 */

import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import {
  createExpiredSession,
  createExpiringSession,
  createMockTokens,
  createTestSession,
} from '../../setup/test-helpers'

describe('session Data', () => {
  describe('createTestSession', () => {
    it('should create a session with default values', () => {
      const session = createTestSession()

      expect(session.id).toMatch(/^sess_/)
      expect(session.provider).toBe('oidc')
      expect(session.userId).toMatch(/^user_/)
      expect(session.canRefresh).toBe(true)
      expect(session.createdAt).toBeGreaterThan(0)
      expect(session.updatedAt).toBeGreaterThan(0)
      expect(session.expireAt).toBeGreaterThan(session.createdAt)
    })

    it('should create a session with custom provider', () => {
      const session = createTestSession({ provider: 'keycloak' })

      expect(session.provider).toBe('keycloak')
    })

    it('should create a session with custom userId', () => {
      const session = createTestSession({ userId: 'custom-user-123' })

      expect(session.userId).toBe('custom-user-123')
    })

    it('should create a session with custom expiration', () => {
      const session = createTestSession({ expiresIn: 7200 })

      const expectedExpireAt = session.createdAt + 7200
      expect(session.expireAt).toBe(expectedExpireAt)
    })

    it('should create a session without refresh capability', () => {
      const session = createTestSession({ canRefresh: false })

      expect(session.canRefresh).toBe(false)
    })

    it('should include access token when provided', () => {
      const session = createTestSession({ accessToken: 'test-access-token' })

      expect(session.accessToken).toBe('test-access-token')
    })

    it('should include ID token when provided', () => {
      const session = createTestSession({ idToken: 'test-id-token' })

      expect(session.idToken).toBe('test-id-token')
    })
  })

  describe('createExpiredSession', () => {
    it('should create a session that has already expired', () => {
      const session = createExpiredSession()
      const now = Math.floor(Date.now() / 1000)

      expect(session.expireAt).toBeLessThan(now)
    })

    it('should have updatedAt before expireAt', () => {
      const session = createExpiredSession()

      expect(session.updatedAt).toBeLessThan(session.expireAt)
    })

    it('should have createdAt before updatedAt', () => {
      const session = createExpiredSession()

      expect(session.createdAt).toBeLessThan(session.updatedAt)
    })
  })

  describe('createExpiringSession', () => {
    it('should create a session expiring in specified seconds', () => {
      const secondsUntilExpiry = 60
      const session = createExpiringSession(secondsUntilExpiry)
      const now = Math.floor(Date.now() / 1000)

      expect(session.expireAt).toBeGreaterThan(now)
      expect(session.expireAt).toBeLessThanOrEqual(now + secondsUntilExpiry + 1)
    })

    it('should create a session expiring very soon by default', () => {
      const session = createExpiringSession()
      const now = Math.floor(Date.now() / 1000)

      expect(session.expireAt - now).toBeLessThanOrEqual(61)
    })
  })

  describe('session Expiration Logic', () => {
    it('should correctly identify expired sessions', () => {
      const expiredSession = createExpiredSession()
      const now = Math.floor(Date.now() / 1000)

      const isExpired = expiredSession.expireAt < now
      expect(isExpired).toBe(true)
    })

    it('should correctly identify valid sessions', () => {
      const validSession = createTestSession()
      const now = Math.floor(Date.now() / 1000)

      const isExpired = validSession.expireAt < now
      expect(isExpired).toBe(false)
    })

    it('should correctly identify sessions needing refresh', () => {
      const expiringSession = createExpiringSession(60)
      const now = Math.floor(Date.now() / 1000)

      const refreshThreshold = 300
      const needsRefresh = (expiringSession.expireAt - now) < refreshThreshold

      expect(needsRefresh).toBe(true)
    })

    it('should not need refresh if far from expiration', () => {
      const validSession = createTestSession({ expiresIn: 3600 })
      const now = Math.floor(Date.now() / 1000)

      const refreshThreshold = 300
      const needsRefresh = (validSession.expireAt - now) < refreshThreshold

      expect(needsRefresh).toBe(false)
    })
  })
})

describe('mock Tokens', () => {
  describe('createMockTokens', () => {
    it('should create tokens with default values', () => {
      const tokens = createMockTokens()

      expect(tokens.accessToken).toBeDefined()
      expect(tokens.refreshToken).toBeDefined()
      expect(tokens.tokenType).toBe('Bearer')
      expect(tokens.expiresIn).toBe(3600)
      expect(tokens.scope).toBe('openid profile')
    })

    it('should create tokens with custom userId', () => {
      const tokens = createMockTokens({ userId: 'custom-user' })

      const [, payloadBase64] = tokens.accessToken.split('.')
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString())

      expect(payload.sub).toBe('custom-user')
    })

    it('should create tokens with custom scopes', () => {
      const customScopes = ['openid', 'profile', 'email', 'offline_access']
      const tokens = createMockTokens({ scopes: customScopes })

      expect(tokens.scope).toBe(customScopes.join(' '))
    })

    it('should create tokens with custom expiration', () => {
      const tokens = createMockTokens({ expiresIn: 7200 })

      expect(tokens.expiresIn).toBe(7200)
    })

    it('should include ID token when requested', () => {
      const tokens = createMockTokens({ includeIdToken: true })

      expect(tokens.idToken).toBeDefined()
      expect(tokens.idToken).toContain('.')
    })

    it('should not include ID token by default', () => {
      const tokens = createMockTokens()

      expect(tokens.idToken).toBeUndefined()
    })

    it('should create tokens with custom issuer', () => {
      const customIssuer = 'https://custom-issuer.example.com'
      const tokens = createMockTokens({ issuer: customIssuer })

      const [, payloadBase64] = tokens.accessToken.split('.')
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString())

      expect(payload.iss).toBe(customIssuer)
    })

    it('should create tokens with custom audience', () => {
      const customAudience = 'custom-client-id'
      const tokens = createMockTokens({ audience: customAudience })

      const [, payloadBase64] = tokens.accessToken.split('.')
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString())

      expect(payload.aud).toBe(customAudience)
    })

    it('should generate unique refresh tokens', () => {
      const tokens1 = createMockTokens()
      const tokens2 = createMockTokens()

      expect(tokens1.refreshToken).not.toEqual(tokens2.refreshToken)
    })

    it('should generate valid JWT structure for access token', () => {
      const tokens = createMockTokens()

      const parts = tokens.accessToken.split('.')
      expect(parts).toHaveLength(3)

      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString())
      expect(header.alg).toBe('RS256')
      expect(header.typ).toBe('JWT')

      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
      expect(payload.iss).toBeDefined()
      expect(payload.sub).toBeDefined()
      expect(payload.exp).toBeDefined()
    })
  })
})
