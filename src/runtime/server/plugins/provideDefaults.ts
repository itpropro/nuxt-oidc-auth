import { genBase64FromBytes, generateRandomUrlSafeString } from '../utils/security'
import { subtle } from 'uncrypto'

export default defineNitroPlugin(async () => {
  if (!process.env.NUXT_OIDC_SESSION_SECRET || process.env.NUXT_OIDC_SESSION_SECRET.length < 48) {
    const randomSecret = generateRandomUrlSafeString()
    process.env.NUXT_OIDC_SESSION_SECRET = randomSecret
    console.warn('[nuxt-oidc-auth]: No session secret set, using a random secret. Please set NUXT_OIDC_SESSION_SECRET in your environment with at least 48 chars.')
    console.info(`[nuxt-oidc-auth]: NUXT_OIDC_SESSION_SECRET=${randomSecret}`)
  }
  if (!process.env.NUXT_OIDC_TOKEN_KEY) {
    const randomKey = genBase64FromBytes(new Uint8Array(await subtle.exportKey('raw', await subtle.generateKey({ name: 'AES-GCM', length: 256, }, true, ['encrypt', 'decrypt']))))
    process.env.NUXT_OIDC_TOKEN_KEY = randomKey
    console.warn('[nuxt-oidc-auth]: No refresh token key set, using a random key. Please set NUXT_OIDC_TOKEN_KEY in your environment. Refresh tokens saved in this session will be inaccessible after a server restart.')
    console.info(`[nuxt-oidc-auth]: NUXT_OIDC_TOKEN_KEY=${randomKey}`)
  }
  if (!process.env.NUXT_OIDC_AUTH_SESSION_SECRET) {
    const randomKey = generateRandomUrlSafeString()
    process.env.NUXT_OIDC_AUTH_SESSION_SECRET = randomKey
    console.warn('[nuxt-oidc-auth]: No auth session secret set, using a random secret. Please set NUXT_OIDC_AUTH_SESSION_SECRET in your environment.')
    console.info(`[nuxt-oidc-auth]: NUXT_OIDC_AUTH_SESSION_SECRET=${randomKey}`)
  }
})
