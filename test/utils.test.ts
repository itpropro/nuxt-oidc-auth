// @vitest-environment nuxt

import { describe, expect, it } from 'vitest'
import { generatePkceCodeChallenge, generatePkceVerifier, generateRandomUrlSafeString } from '../src/runtime/server/utils/security'

describe('security', () => {
  const length = 68
  it('should generate a valid verifier', () => {
    const output = generatePkceVerifier()
    expect(output).to.toHaveLength(64)
  })
  it('should generate a valid verifier with custom length', () => {
    const output = generatePkceVerifier(length)
    expect(output).to.toHaveLength(length)
  })
  it('should validate the length', () => {
    expect(() => generatePkceVerifier(42)).toThrow()
    expect(() => generatePkceVerifier(129)).toThrow()
  })
  it('should generate a valid challenge', async () => {
    const verifier = '9d509f04c574c228491421ddd35f209e6952379d025242dcdd51f7f0'
    const challenge = '3PKu5yGD74_vuhAQI6-YRiwomm09qfoy1ZV6naT2L1I'
    const output = await generatePkceCodeChallenge(verifier)
    expect(output).to.equal(challenge)
  })
  it('should generate a valid base64url encoded string', () => {
    const output = generateRandomUrlSafeString(length)
    expect(output).toHaveLength(length)
    expect(output).not.toContain('+')
    expect(output).not.toContain('/')
    expect(output).not.toContain('=')
  })
})

describe('config', () => {
  it.todo('should merge arrays correctly')
})

describe('oidc', () => {
  it.todo('should generate a valid form data request')
  it.todo('should correctly transform objects keys to snakeCase')
})

describe('session', () => {
  it.todo('should expose session hooks')
})
