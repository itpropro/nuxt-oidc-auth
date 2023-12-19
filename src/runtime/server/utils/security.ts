import { subtle, getRandomValues } from 'uncrypto'
import { genBase64FromBytes, genBase64FromString, genBytesFromBase64, genStringFromBase64 } from 'knitwork'
import * as jose from 'jose'

// https://datatracker.ietf.org/doc/html/rfc7519#section-4.1.1
export interface JwtPayload {
  iss?: string
  sub?: string
  aud?: string | string[]
  exp?: number
  nbf?: number
  iat?: number
  jti?: string
  [key: string]: string | number | string[] | number[] | undefined
}

// https://datatracker.ietf.org/doc/html/rfc7519#section-5, https://www.rfc-editor.org/rfc/rfc7515.html#section-4
interface JwtHeader {
  alg: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512' | 'ES256' | 'ES384' | 'ES512' | 'PS256' | 'PS384' | 'PS512' | 'none'
  jku?: string
  jwk?: string
  kid?: string
  x5u?: string | string[]
  x5c?: string | string[]
  x5t?: string
  'x5t#S256'?: string
  crit?: Array<Exclude<keyof JwtHeader, 'crit'>>
  typ?: string
  cty?: string
  [key: string]: unknown
}

export interface JwtToken {
  header: JwtHeader
  payload: JwtPayload
  signature: string
}

export interface EncryptedRefreshToken {
  encryptedRefreshToken: string
  iv: string
}

export interface ValidateAccessTokenOptions {
  issuer: string
  audience: string | string[]
  jwksUri: string
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

/**
 * Decode and parse a standard 3 segment JWT token
 * @param token
 * @returns A decoded JWT token object with a JSON parsed header and payload
 */
export function parseJwtToken(token: string): JwtPayload {
  const [header, payload, signature, ...rest] = token.split('.')
  if (!header || !payload || !signature || rest.length)
    throw new Error('Invalid JWT token')
  return JSON.parse(genStringFromBase64(payload, { encoding: 'url' }))
  /* Full JWT  {
      header: JSON.parse(genStringFromBase64(header, { encoding: 'url' })),
      payload: JSON.parse(genStringFromBase64(payload, { encoding: 'url' })),
      signature: genStringFromBase64(signature, { encoding: 'url' }),
    } */
}

export async function validateToken(token: string, options: ValidateAccessTokenOptions): Promise<JwtPayload> {
  console.log(options)

  const jwks = jose.createRemoteJWKSet(new URL(options.jwksUri))
  const { payload, protectedHeader } = await jose.jwtVerify(token, jwks, {
    issuer: options.issuer,
    audience: options.audience,
  })
  console.log(protectedHeader)
  return payload as JwtPayload
}
