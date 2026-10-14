/**
 * Token Encryption/Decryption Tests
 *
 * Tests for secure token storage using encryption.
 * Validates that tokens are properly encrypted and can be decrypted.
 */

import { describe, expect, it } from 'vitest'

import { base64ToUint8Array, uint8ArrayToBase64 } from '../../../src/runtime/server/utils/encoding'
import type { EncryptedToken } from '../../../src/runtime/server/utils/security'
import { decryptToken, encryptToken } from '../../../src/runtime/server/utils/security'

const BASE64_PATTERN = /^[a-z0-9+/]+=*$/iu

function generateTestKey(): string {
  const keyBytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(keyBytes)
  return uint8ArrayToBase64(keyBytes)
}

describe('token encryption', () => {
  const testKey = generateTestKey()

  describe('encryptToken', () => {
    it('should encrypt a token and return EncryptedToken object', async () => {
      const token = 'my-secret-access-token'
      const encrypted = await encryptToken(token, testKey)

      expect(encrypted).toBeDefined()
      expect(encrypted.encryptedToken).toBeDefined()
      expect(encrypted.iv).toBeDefined()
      expect(typeof encrypted.encryptedToken).toBe('string')
      expect(typeof encrypted.iv).toBe('string')
    })

    it('should produce different ciphertext for same plaintext (due to random IV)', async () => {
      const token = 'my-secret-access-token'

      const encrypted1 = await encryptToken(token, testKey)
      const encrypted2 = await encryptToken(token, testKey)

      expect(encrypted1.iv).not.toStrictEqual(encrypted2.iv)
      expect(encrypted1.encryptedToken).not.toStrictEqual(encrypted2.encryptedToken)
    })

    it('should handle empty string', async () => {
      const encrypted = await encryptToken('', testKey)
      expect(encrypted.encryptedToken).toBeDefined()
      expect(encrypted.iv).toBeDefined()
    })

    it('should handle long tokens', async () => {
      const longToken = 'a'.repeat(10000)
      const encrypted = await encryptToken(longToken, testKey)

      expect(encrypted.encryptedToken).toBeDefined()
      expect(typeof encrypted.encryptedToken).toBe('string')
    })

    it('should handle tokens with special characters', async () => {
      const specialToken = 'token-with-special-chars-!@#$%^&*()_+-=[]{}|;:,.<>?'
      const encrypted = await encryptToken(specialToken, testKey)

      expect(encrypted.encryptedToken).toBeDefined()
    })

    it('should handle unicode characters', async () => {
      const unicodeToken = 'token-with-unicode-🔐🎉-日本語'
      const encrypted = await encryptToken(unicodeToken, testKey)

      expect(encrypted.encryptedToken).toBeDefined()
    })
  })

  describe('decryptToken', () => {
    it('should decrypt an encrypted token back to original', async () => {
      const originalToken = 'my-secret-access-token'
      const encrypted = await encryptToken(originalToken, testKey)
      const decrypted = await decryptToken(encrypted, testKey)

      expect(decrypted).toStrictEqual(originalToken)
    })

    it('should correctly round-trip empty string', async () => {
      const encrypted = await encryptToken('', testKey)
      const decrypted = await decryptToken(encrypted, testKey)

      expect(decrypted).toBe('')
    })

    it('should correctly round-trip long tokens', async () => {
      const longToken = 'a'.repeat(10000)
      const encrypted = await encryptToken(longToken, testKey)
      const decrypted = await decryptToken(encrypted, testKey)

      expect(decrypted).toStrictEqual(longToken)
    })

    it('should correctly round-trip tokens with special characters', async () => {
      const specialToken = 'token-with-special-chars-!@#$%^&*()_+-=[]{}|;:,.<>?'
      const encrypted = await encryptToken(specialToken, testKey)
      const decrypted = await decryptToken(encrypted, testKey)

      expect(decrypted).toStrictEqual(specialToken)
    })

    it('should correctly round-trip unicode characters', async () => {
      const unicodeToken = 'token-with-unicode-🔐🎉-日本語'
      const encrypted = await encryptToken(unicodeToken, testKey)
      const decrypted = await decryptToken(encrypted, testKey)

      expect(decrypted).toStrictEqual(unicodeToken)
    })
  })

  describe('encryption security', () => {
    it('should fail decryption with wrong key', async () => {
      const originalToken = 'my-secret-access-token'
      const encrypted = await encryptToken(originalToken, testKey)

      const wrongKey = generateTestKey()

      await expect(decryptToken(encrypted, wrongKey)).rejects.toThrow(DOMException)
    })

    it('should fail decryption with tampered ciphertext', async () => {
      const originalToken = 'my-secret-access-token'
      const encrypted = await encryptToken(originalToken, testKey)

      const tamperedEncrypted: EncryptedToken = {
        ...encrypted,
        encryptedToken: `${encrypted.encryptedToken.slice(0, -5)}XXXXX`,
      }

      await expect(decryptToken(tamperedEncrypted, testKey)).rejects.toThrow(DOMException)
    })

    it('should fail decryption with tampered IV', async () => {
      const originalToken = 'my-secret-access-token'
      const encrypted = await encryptToken(originalToken, testKey)

      const tamperedEncrypted: EncryptedToken = {
        ...encrypted,
        iv: `${encrypted.iv.slice(0, -2)}XX`,
      }

      await expect(decryptToken(tamperedEncrypted, testKey)).rejects.toThrow(DOMException)
    })

    it('should not expose plaintext in encrypted output', async () => {
      const sensitiveToken = 'super-secret-access-token-12345'
      const encrypted = await encryptToken(sensitiveToken, testKey)

      expect(encrypted.encryptedToken).not.toContain('super-secret')
      expect(encrypted.encryptedToken).not.toContain('12345')
      expect(encrypted.iv).not.toContain('super-secret')
    })

    it('should use unique IV for each encryption', async () => {
      const token = 'same-token-multiple-times'
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(encryptToken(token, testKey))
      }
      const encryptions = await Promise.all(promises)

      const ivSet = new Set(encryptions.map((e) => e.iv))
      expect(ivSet.size).toBe(10)
    })
  })

  describe('key handling', () => {
    it('should work with 256-bit keys (32 bytes)', async () => {
      const key = generateTestKey()
      const keyBytes = base64ToUint8Array(key)

      expect(keyBytes).toHaveLength(32)

      const token = 'test-token'
      const encrypted = await encryptToken(token, key)
      const decrypted = await decryptToken(encrypted, key)
      expect(decrypted).toBe(token)
    })

    it('should produce consistent results with same key', async () => {
      const key = generateTestKey()
      const token = 'consistent-test-token'

      const encrypted1 = await encryptToken(token, key)
      const encrypted2 = await encryptToken(token, key)

      const decrypted1 = await decryptToken(encrypted1, key)
      const decrypted2 = await decryptToken(encrypted2, key)

      expect(decrypted1).toBe(token)
      expect(decrypted2).toBe(token)
    })

    it('should accept legacy data URL encoded keys', async () => {
      const key = generateTestKey()
      const legacyKey = `data:;base64,${key}`
      const token = 'legacy-key-test-token'

      const encryptedWithRawKey = await encryptToken(token, key)
      const encryptedWithLegacyKey = await encryptToken(token, legacyKey)

      await expect(decryptToken(encryptedWithRawKey, legacyKey)).resolves.toBe(token)
      await expect(decryptToken(encryptedWithLegacyKey, key)).resolves.toBe(token)
    })
  })

  describe('output format', () => {
    it('should produce base64 encoded ciphertext', async () => {
      const token = 'test-token'
      const encrypted = await encryptToken(token, testKey)

      expect(encrypted.encryptedToken).toBeDefined()
      expect(encrypted.encryptedToken.length).toBeGreaterThan(0)

      const prefixIndex = encrypted.encryptedToken.indexOf('base64,')
      const base64Part =
        prefixIndex === -1
          ? encrypted.encryptedToken
          : encrypted.encryptedToken.slice(prefixIndex + 'base64,'.length)

      expect(base64Part).toMatch(BASE64_PATTERN)
    })

    it('should produce base64 encoded IV', async () => {
      const token = 'test-token'
      const encrypted = await encryptToken(token, testKey)

      expect(encrypted.iv).toMatch(BASE64_PATTERN)
    })

    it('iV should be 12 bytes (96 bits) for AES-GCM', async () => {
      const token = 'test-token'
      const encrypted = await encryptToken(token, testKey)

      const ivBytes = base64ToUint8Array(encrypted.iv)
      expect(ivBytes).toHaveLength(12)
    })

    it('should produce valid EncryptedToken structure', async () => {
      const token = 'test-token'
      const encrypted = await encryptToken(token, testKey)

      expect(encrypted).toHaveProperty('encryptedToken')
      expect(encrypted).toHaveProperty('iv')
      expect(typeof encrypted.encryptedToken).toBe('string')
      expect(typeof encrypted.iv).toBe('string')
      expect(encrypted.encryptedToken.length).toBeGreaterThan(0)
      expect(encrypted.iv.length).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    it('should handle JSON-like tokens', async () => {
      const jsonToken = JSON.stringify({ access_token: 'abc123', expires_in: 3600 })
      const encrypted = await encryptToken(jsonToken, testKey)
      const decrypted = await decryptToken(encrypted, testKey)

      expect(decrypted).toBe(jsonToken)
      expect(JSON.parse(decrypted)).toStrictEqual({ access_token: 'abc123', expires_in: 3600 })
    })

    it('should handle tokens with newlines', async () => {
      const multilineToken = 'line1\nline2\nline3'
      const encrypted = await encryptToken(multilineToken, testKey)
      const decrypted = await decryptToken(encrypted, testKey)

      expect(decrypted).toBe(multilineToken)
    })

    it('should handle tokens with null bytes', async () => {
      const tokenWithNull = 'before\u0000after'
      const encrypted = await encryptToken(tokenWithNull, testKey)
      const decrypted = await decryptToken(encrypted, testKey)

      expect(decrypted).toBe(tokenWithNull)
    })

    it('should handle very short tokens', async () => {
      const shortToken = 'x'
      const encrypted = await encryptToken(shortToken, testKey)
      const decrypted = await decryptToken(encrypted, testKey)

      expect(decrypted).toBe(shortToken)
    })
  })
})
