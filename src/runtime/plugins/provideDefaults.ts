// @ts-expect-error - Missing Nitro type exports in Nuxt
import { defineNitroPlugin, useRuntimeConfig } from '#imports'
import { generateRandomUrlSafeString } from '../server/utils/security'
import { arrayBufferToBase64 } from '../server/utils/encoding'

const webCrypto = globalThis.crypto

// Only reveal generated secrets in full when dev mode is enabled. In any other mode we keep the
// first five characters and mask the rest so the value is recognizable without leaking it into logs.
function formatSecretForLog(secret: string, revealFull: boolean): string {
  if (revealFull) return secret
  return `${secret.slice(0, 5)}${'*'.repeat(Math.max(0, secret.length - 5))}`
}

export default defineNitroPlugin(async () => {
  const revealSecrets = !!useRuntimeConfig().oidc?.devMode?.enabled

  if (!process.env.NUXT_OIDC_SESSION_SECRET || process.env.NUXT_OIDC_SESSION_SECRET.length < 48) {
    const randomSecret = generateRandomUrlSafeString()
    process.env.NUXT_OIDC_SESSION_SECRET = randomSecret
    console.warn(
      '[nuxt-oidc-auth]: No session secret set, using a random secret. Please set NUXT_OIDC_SESSION_SECRET in your environment with at least 48 chars.',
    )
    console.info(
      `[nuxt-oidc-auth]: NUXT_OIDC_SESSION_SECRET=${formatSecretForLog(randomSecret, revealSecrets)}`,
    )
  }
  if (!process.env.NUXT_OIDC_TOKEN_KEY) {
    const randomKey = arrayBufferToBase64(
      await webCrypto.subtle.exportKey(
        'raw',
        await webCrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
          'encrypt',
          'decrypt',
        ]),
      ),
    )
    process.env.NUXT_OIDC_TOKEN_KEY = randomKey
    console.warn(
      '[nuxt-oidc-auth]: No refresh token key set, using a random key. Please set NUXT_OIDC_TOKEN_KEY in your environment. Refresh tokens saved in this session will be inaccessible after a server restart.',
    )
    console.info(
      `[nuxt-oidc-auth]: NUXT_OIDC_TOKEN_KEY=${formatSecretForLog(randomKey, revealSecrets)}`,
    )
  }
  if (!process.env.NUXT_OIDC_AUTH_SESSION_SECRET) {
    const randomKey = generateRandomUrlSafeString()
    process.env.NUXT_OIDC_AUTH_SESSION_SECRET = randomKey
    console.warn(
      '[nuxt-oidc-auth]: No auth session secret set, using a random secret. Please set NUXT_OIDC_AUTH_SESSION_SECRET in your environment.',
    )
    console.info(
      `[nuxt-oidc-auth]: NUXT_OIDC_AUTH_SESSION_SECRET=${formatSecretForLog(randomKey, revealSecrets)}`,
    )
  }
})
