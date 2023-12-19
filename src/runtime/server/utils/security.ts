import { subtle, getRandomValues } from 'uncrypto'
import { genBase64FromBytes, genBase64FromString, genBytesFromBase64, genStringFromBase64 } from 'knitwork'

interface JwtToken {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
}

export interface EncryptedRefreshToken {
  encryptedRefreshToken: string
  iv: string
}

const unreservedCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~'

/**
 * Encrypts a message with AES-GCM.
 * @param text The text to encrypt.
 * @param key The key to use for encryption.
 * @returns The base64 encoded encrypted message.
 */
async function encryptMessage(text: string, key: CryptoKey, iv: Uint8Array) {
  const encoded = new TextEncoder().encode(text)
  const ciphertext = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encoded
  )
  return genBase64FromBytes(new Uint8Array(ciphertext))
}

/**
 * Decrypts a message with AES-GCM.
 * @param text The text to decrypt.
 * @param key The key to use for decryption.
 * @returns The decrypted message.
 */
async function decryptMessage(text: string, key: CryptoKey, iv: Uint8Array) {
  const decoded = genBytesFromBase64(text)
  return await subtle.decrypt({ name: 'AES-GCM', iv }, key, decoded)
}

/**
 * Generates a PKCE (Proof Key for Code Exchange) verifier string.
 * @param length The length of the verifier string. Defaults to 64.
 * @returns The generated PKCE verifier string.
 * @see https://datatracker.ietf.org/doc/html/rfc7636#section-4.1
 */
export function generatePkceVerifier(length: number = 64) {
  if (length < 43 || length > 128) {
    throw new Error('Length must be between 43 and 128')
  }
  const randomValues = getRandomValues(new Uint8Array(length))
  let pkceVerifier = ''
  for (let i = 0; i < randomValues.length; i++) {
    pkceVerifier += unreservedCharacters[randomValues[i] % unreservedCharacters.length]
  }
  return pkceVerifier
}

/**
 * Generates a PKCE (Proof Key for Code Exchange) code challenge.
 * @param pkceVerifier The PKCE verifier string.
 * @returns The generated PKCE code challenge.
 * @see https://datatracker.ietf.org/doc/html/rfc7636#section-4.2
 */
export async function generatePkceCodeChallenge(pkceVerifier: string) {
  const challengeBuffer = await subtle.digest({ name: 'SHA-256' }, new TextEncoder().encode(pkceVerifier))
  return genBase64FromBytes(new Uint8Array(challengeBuffer), true)
}

/**
 * Generates a random URL-safe string. The resulting string can be a different size
 * @param length The length of the underlying byte array. Defaults to 48.
 * @param truncate Whether to truncate the generated string to the given length. Defaults to false.
 * @returns The generated URL-safe bytes as base64url encoded string.
 */
export function generateRandomUrlSafeString(length: number = 48): string {
  const randomBytes = new Uint8Array(length)
  getRandomValues(randomBytes)
  return genBase64FromString(String.fromCharCode(...randomBytes), { encoding: 'url' }).slice(0, length)
}

/**
 * Decode and parse a standard 3 segment JWT token
 * @param token
 * @returns A decoded JWT token object with a JSON parsed header and payload
 */
export function parseJwtToken(token: string): JwtToken {
  const [header, payload, signature, ...rest] = token.split('.')
  if (!header || !payload || !signature || rest.length)
    throw new Error('Invalid JWT token')
  return {
    header: JSON.parse(genStringFromBase64(header, { encoding: 'url' })),
    payload: JSON.parse(genStringFromBase64(payload, { encoding: 'url' })),
    signature: genStringFromBase64(signature, { encoding: 'url' }),
  }
}

/**
 * Encrypts a refresh token with AES-GCM.
 * @param refreshToken The refresh token to encrypt.
 * @param key The base64 encoded 256-bit key to use for encryption.
 * @returns The base64 encoded encrypted refresh token and the base64 encoded initialization vector.
 */
export async function encryptRefreshToken(refreshToken: string, key: string): Promise<EncryptedRefreshToken> {
  const secretKey = await subtle.importKey('raw', Buffer.from(key, 'base64'), {
    name: 'AES-GCM',
    length: 256
  }, true, ['encrypt', 'decrypt'])
  const iv = getRandomValues(new Uint8Array(12))
  const encryptedRefreshToken = await encryptMessage(refreshToken, secretKey, iv)
  return {
    encryptedRefreshToken,
    iv: genBase64FromBytes(iv),
  }
}

/**
 * Decrypts a refresh token with AES-GCM.
 * @param input The encrypted refresh token and the initialization vector.
 * @param key The base64 encoded 256-bit key to use for decryption.
 * @returns The decrypted refresh token.
 */
export async function decryptRefreshToken(input: EncryptedRefreshToken, key: string): Promise<string> {
  const { encryptedRefreshToken, iv } = input
  const secretKey = await subtle.importKey('raw', Buffer.from(key, 'base64'), {
    name: 'AES-GCM',
    length: 256
  }, true, ['encrypt', 'decrypt'])
  const decrypted = await decryptMessage(encryptedRefreshToken, secretKey, genBytesFromBase64(iv))
  return new TextDecoder().decode(decrypted)
}
