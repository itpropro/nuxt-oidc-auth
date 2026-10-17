import { arrayBufferToBase64 } from './encoding'
import { generateRandomUrlSafeString } from './security'

const webCrypto = globalThis.crypto
const REDACTED_VALUE = '[redacted]'

export type DefaultSecretName =
  | 'NUXT_OIDC_SESSION_SECRET'
  | 'NUXT_OIDC_TOKEN_KEY'
  | 'NUXT_OIDC_AUTH_SESSION_SECRET'

const LOGGED_PREFIX_LENGTH = 5

// Only a five-character prefix of a generated value may reach stdout or stderr, independent of
// NODE_ENV or dev mode. Callers cut the prefix where the value is generated, so the full secret never
// reaches the logger. Developers retrieve full values through Nuxt DevTools.
function logGeneratedSecret(name: DefaultSecretName, warning: string, prefix: string): void {
  console.warn(`[nuxt-oidc-auth]: ${warning}`)
  console.info(`[nuxt-oidc-auth]: ${name}=${prefix}${REDACTED_VALUE}`)
}

/**
 * Set random values in `process.env` for missing session and token secrets.
 * @returns The names of the generated secrets.
 */
export async function provideDefaultSecrets(): Promise<DefaultSecretName[]> {
  const generated: DefaultSecretName[] = []
  if ((process.env['NUXT_OIDC_SESSION_SECRET']?.length ?? 0) < 48) {
    const secret = generateRandomUrlSafeString()
    process.env['NUXT_OIDC_SESSION_SECRET'] = secret
    generated.push('NUXT_OIDC_SESSION_SECRET')
    logGeneratedSecret(
      'NUXT_OIDC_SESSION_SECRET',
      'No session secret set, using a random secret. Please set NUXT_OIDC_SESSION_SECRET in your environment with at least 48 chars.',
      secret.slice(0, LOGGED_PREFIX_LENGTH),
    )
  }
  if ((process.env['NUXT_OIDC_TOKEN_KEY'] ?? '') === '') {
    const key = arrayBufferToBase64(
      await webCrypto.subtle.exportKey(
        'raw',
        await webCrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
          'encrypt',
          'decrypt',
        ]),
      ),
    )
    process.env['NUXT_OIDC_TOKEN_KEY'] = key
    generated.push('NUXT_OIDC_TOKEN_KEY')
    logGeneratedSecret(
      'NUXT_OIDC_TOKEN_KEY',
      'No token encryption key set, using a random key. Please set NUXT_OIDC_TOKEN_KEY in your environment. Tokens saved in this session will be inaccessible after a server restart.',
      key.slice(0, LOGGED_PREFIX_LENGTH),
    )
  }
  if ((process.env['NUXT_OIDC_AUTH_SESSION_SECRET'] ?? '') === '') {
    const secret = generateRandomUrlSafeString()
    process.env['NUXT_OIDC_AUTH_SESSION_SECRET'] = secret
    generated.push('NUXT_OIDC_AUTH_SESSION_SECRET')
    logGeneratedSecret(
      'NUXT_OIDC_AUTH_SESSION_SECRET',
      'No auth session secret set, using a random secret. Please set NUXT_OIDC_AUTH_SESSION_SECRET in your environment.',
      secret.slice(0, LOGGED_PREFIX_LENGTH),
    )
  }
  return generated
}
