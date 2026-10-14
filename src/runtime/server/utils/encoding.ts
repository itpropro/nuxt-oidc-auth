interface Base64Options {
  urlSafe?: boolean
}

function normalizeBase64(input: string) {
  const normalized = input.replaceAll('-', '+').replaceAll('_', '/')
  const paddingLength = (4 - (normalized.length % 4)) % 4
  return normalized.padEnd(normalized.length + paddingLength, '=')
}

function encodeBase64(bytes: Uint8Array, options: Base64Options = {}) {
  let base64: string
  if (typeof Buffer === 'undefined') {
    let binary = ''
    for (const byte of bytes) {
      binary += String.fromCodePoint(byte)
    }
    base64 = btoa(binary)
  } else {
    base64 = Buffer.from(bytes).toString('base64')
  }

  if (options.urlSafe === true) {
    return base64.replaceAll('+', '-').replaceAll('/', '_').replaceAll(/=+$/gu, '')
  }

  return base64
}

function decodeBase64(input: string) {
  const normalized = normalizeBase64(input)
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(normalized, 'base64'))
  }

  const binary = atob(normalized)
  return Uint8Array.from(binary, (char) => Number(char.codePointAt(0)))
}

export function textToBase64(text: string, options: Base64Options = {}): string {
  return encodeBase64(new TextEncoder().encode(text), options)
}

export function arrayBufferToBase64(buffer: ArrayBuffer, options: Base64Options = {}): string {
  return encodeBase64(new Uint8Array(buffer), options)
}

export function base64ToText(input: string): string {
  return new TextDecoder().decode(decodeBase64(input))
}

export function base64ToUint8Array(input: string): Uint8Array<ArrayBuffer> {
  return decodeBase64(input)
}

export function uint8ArrayToBase64(input: Uint8Array, options: Base64Options = {}): string {
  return encodeBase64(input, options)
}
