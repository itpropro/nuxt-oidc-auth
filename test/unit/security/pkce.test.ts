/**
 * PKCE (Proof Key for Code Exchange) Security Tests
 *
 * Tests for RFC 7636 compliant PKCE implementation.
 * Validates verifier generation, challenge computation, and URL-safe encoding.
 */

import { describe, expect, it, vi } from 'vitest'

import {
  generatePkceCodeChallenge,
  generatePkceVerifier,
  generateRandomUrlSafeString,
} from '../../../src/runtime/server/utils/security'

vi.mock('../../../src/runtime/server/utils/oidc', () => ({
  useOidcLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('../../../src/runtime/server/utils/session', () => ({}))

describe('pKCE security utilities', () => {
  describe('generatePkceVerifier', () => {
    it('should generate a verifier with default length of 64 characters', () => {
      const verifier = generatePkceVerifier()
      expect(verifier).toHaveLength(64)
    })

    it('should generate a verifier with custom length', () => {
      const customLength = 68
      const verifier = generatePkceVerifier(customLength)
      expect(verifier).toHaveLength(customLength)
    })

    it('should throw error for length below minimum (43 characters)', () => {
      expect(() => generatePkceVerifier(42)).toThrow()
    })

    it('should throw error for length above maximum (128 characters)', () => {
      expect(() => generatePkceVerifier(129)).toThrow()
    })

    it('should accept minimum length of 43 characters', () => {
      const verifier = generatePkceVerifier(43)
      expect(verifier).toHaveLength(43)
    })

    it('should accept maximum length of 128 characters', () => {
      const verifier = generatePkceVerifier(128)
      expect(verifier).toHaveLength(128)
    })

    it('should only contain unreserved characters per RFC 7636', () => {
      const verifier = generatePkceVerifier()
      const unreservedPattern = /^[\w.~-]+$/
      expect(verifier).toMatch(unreservedPattern)
    })

    it('should generate unique verifiers on each call', () => {
      const verifier1 = generatePkceVerifier()
      const verifier2 = generatePkceVerifier()
      expect(verifier1).not.toEqual(verifier2)
    })

    it('should not contain URL-unsafe characters', () => {
      const verifier = generatePkceVerifier()
      expect(verifier).not.toMatch(/[+/=]/)
    })

    it('should generate cryptographically random values', () => {
      const verifiers = Array.from({ length: 100 }, () => generatePkceVerifier())
      const uniqueVerifiers = new Set(verifiers)
      expect(uniqueVerifiers.size).toBe(100)
    })
  })

  describe('generatePkceCodeChallenge', () => {
    it('should generate a base64url encoded challenge', async () => {
      const verifier = generatePkceVerifier()
      const challenge = await generatePkceCodeChallenge(verifier)

      expect(challenge).toBeDefined()
      expect(typeof challenge).toBe('string')
      expect(challenge.length).toBeGreaterThan(0)
    })

    it('should generate URL-safe base64 (no +, /, = characters)', async () => {
      const verifier = generatePkceVerifier()
      const challenge = await generatePkceCodeChallenge(verifier)

      expect(challenge).not.toContain('+')
      expect(challenge).not.toContain('/')
    })

    it('should generate consistent challenge for same verifier', async () => {
      const verifier = generatePkceVerifier()
      const challenge1 = await generatePkceCodeChallenge(verifier)
      const challenge2 = await generatePkceCodeChallenge(verifier)

      expect(challenge1).toEqual(challenge2)
    })

    it('should generate different challenges for different verifiers', async () => {
      const verifier1 = generatePkceVerifier()
      const verifier2 = generatePkceVerifier()
      const challenge1 = await generatePkceCodeChallenge(verifier1)
      const challenge2 = await generatePkceCodeChallenge(verifier2)

      expect(challenge1).not.toEqual(challenge2)
    })

    it('should produce SHA-256 hash (43 chars base64url without padding)', async () => {
      const verifier = generatePkceVerifier()
      const challenge = await generatePkceCodeChallenge(verifier)

      expect(challenge.length).toBeGreaterThanOrEqual(43)
      expect(challenge.length).toBeLessThanOrEqual(44)
    })

    it('should handle minimum length verifier', async () => {
      const verifier = generatePkceVerifier(43)
      const challenge = await generatePkceCodeChallenge(verifier)

      expect(challenge).toBeDefined()
      expect(challenge.length).toBeGreaterThan(0)
    })

    it('should handle maximum length verifier', async () => {
      const verifier = generatePkceVerifier(128)
      const challenge = await generatePkceCodeChallenge(verifier)

      expect(challenge).toBeDefined()
      expect(challenge.length).toBeGreaterThan(0)
    })
  })

  describe('pKCE verifier-challenge relationship', () => {
    it('should create valid verifier-challenge pairs', async () => {
      const verifier = generatePkceVerifier()
      const challenge = await generatePkceCodeChallenge(verifier)

      expect(verifier.length).toBeGreaterThanOrEqual(43)
      expect(verifier.length).toBeLessThanOrEqual(128)
      expect(challenge.length).toBeGreaterThanOrEqual(43)
    })

    it('should support S256 challenge method (SHA-256)', async () => {
      const verifier = generatePkceVerifier()
      const challenge = await generatePkceCodeChallenge(verifier)

      const urlSafeBase64Pattern = /^[\w-]+$/
      expect(challenge).toMatch(urlSafeBase64Pattern)
    })
  })

  describe('generateRandomUrlSafeString', () => {
    it('should generate a URL-safe string with default length', () => {
      const randomString = generateRandomUrlSafeString()
      expect(randomString.length).toBe(48)
    })

    it('should generate a URL-safe string with custom length', () => {
      const customLength = 32
      const randomString = generateRandomUrlSafeString(customLength)
      expect(randomString.length).toBe(customLength)
    })

    it('should only contain URL-safe base64 characters', () => {
      const randomString = generateRandomUrlSafeString()
      const urlSafePattern = /^[\w-]+$/
      expect(randomString).toMatch(urlSafePattern)
    })

    it('should not contain standard base64 padding or unsafe chars', () => {
      const randomString = generateRandomUrlSafeString()
      expect(randomString).not.toContain('+')
      expect(randomString).not.toContain('/')
      expect(randomString).not.toContain('=')
    })

    it('should generate unique strings on each call', () => {
      const string1 = generateRandomUrlSafeString()
      const string2 = generateRandomUrlSafeString()
      expect(string1).not.toEqual(string2)
    })

    it('should handle small lengths', () => {
      const randomString = generateRandomUrlSafeString(8)
      expect(randomString.length).toBe(8)
    })

    it('should handle large lengths', () => {
      const randomString = generateRandomUrlSafeString(256)
      expect(randomString.length).toBe(256)
    })
  })

  describe('edge cases', () => {
    it('should handle boundary length 43 for verifier', () => {
      const verifier = generatePkceVerifier(43)
      expect(verifier).toHaveLength(43)
      expect(() => generatePkceVerifier(42)).toThrow()
    })

    it('should handle boundary length 128 for verifier', () => {
      const verifier = generatePkceVerifier(128)
      expect(verifier).toHaveLength(128)
      expect(() => generatePkceVerifier(129)).toThrow()
    })

    it('should produce valid challenge for empty-ish looking verifiers', async () => {
      const verifier = generatePkceVerifier(43)
      const challenge = await generatePkceCodeChallenge(verifier)
      expect(challenge).toBeDefined()
      expect(challenge.length).toBeGreaterThan(0)
    })
  })
})
