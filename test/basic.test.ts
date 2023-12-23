import { describe, it, expect } from 'vitest'
import { generatePkceCodeChallenge, generatePkceVerifier, generateRandomUrlSafeString } from '../src/runtime/server/utils/security'

/* describe('ssr', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
  })

  it('renders the index page', async () => {
    // Get response to a server-rendered page with `$fetch`.
    const html = await $fetch('/')
    expect(html).toContain('<div>Nuxt Auth Utils</div>')
  })
})
 */


describe('security', () => {
  const length = 68
  it('Should generate a valid verifier', () => {
    const output = generatePkceVerifier()
    expect(output).to.toHaveLength(64)
  })
  it('Should generate a valid verifier with custom length', () => {
    const output = generatePkceVerifier(length)
    expect(output).to.toHaveLength(length)
  })
  it('Should validate the length', () => {
    expect(() => generatePkceVerifier(42)).toThrow()
    expect(() => generatePkceVerifier(129)).toThrow()
  })
  it('Should generate a valid challenge', async () => {
    const verifier = '9d509f04c574c228491421ddd35f209e6952379d025242dcdd51f7f0'
    const challenge = '3PKu5yGD74_vuhAQI6-YRiwomm09qfoy1ZV6naT2L1I'
    const output = await generatePkceCodeChallenge(verifier)
    expect(output).to.equal(challenge)
  })
  it('Should generate a valid base64url encoded string', () => {
    const output = generateRandomUrlSafeString(length)
    expect(output).toHaveLength(length)
    expect(output).not.toContain('+')
    expect(output).not.toContain('/')
    expect(output).not.toContain('=')
  })
})
