import { describe, expect, it } from 'vitest'
import {
  base64ToText,
  textToBase64,
  uint8ArrayToBase64,
} from '../../../src/runtime/server/utils/encoding'

describe('base64 encoding', () => {
  it('returns raw base64 by default', () => {
    expect(textToBase64('hello')).toBe('aGVsbG8=')
    expect(textToBase64('hello')).not.toContain('data:')
  })

  it('returns unpadded URL-safe base64 when requested', () => {
    expect(uint8ArrayToBase64(new Uint8Array([251, 255]), { urlSafe: true })).toBe('-_8')
  })

  it('decodes standard and URL-safe base64', () => {
    expect(base64ToText('w7/Dvw==')).toBe('ÿÿ')
    expect(base64ToText('w7_Dvw')).toBe('ÿÿ')
  })
})
