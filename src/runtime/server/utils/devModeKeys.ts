import type { JWK } from 'jose'
import { useStorage } from '#imports'
import { exportJWK, generateKeyPair } from 'jose'

interface StoredKeyPair {
  privateKey: JWK
  publicKey: JWK
  kid: string
}

let cachedKeyPair: StoredKeyPair | null = null

function generateKid(): string {
  return `dev-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
}

export async function getOrCreateDevModeKeyPair(): Promise<StoredKeyPair> {
  if (cachedKeyPair) {
    return cachedKeyPair
  }

  const storage = useStorage('oidc:dev')
  const stored = await storage.getItem<StoredKeyPair>('keypair')

  if (stored) {
    cachedKeyPair = stored
    return stored
  }

  const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true })
  const kid = generateKid()

  const privateJwk = await exportJWK(privateKey)
  const publicJwk = await exportJWK(publicKey)

  privateJwk.kid = kid
  privateJwk.alg = 'RS256'
  privateJwk.use = 'sig'

  publicJwk.kid = kid
  publicJwk.alg = 'RS256'
  publicJwk.use = 'sig'

  const keyPair: StoredKeyPair = {
    privateKey: privateJwk,
    publicKey: publicJwk,
    kid,
  }

  await storage.setItem('keypair', keyPair)
  cachedKeyPair = keyPair

  return keyPair
}

export async function getDevModeJwks(): Promise<{ keys: JWK[] }> {
  const keyPair = await getOrCreateDevModeKeyPair()
  return {
    keys: [keyPair.publicKey],
  }
}

export async function clearDevModeKeys(): Promise<void> {
  const storage = useStorage('oidc:dev')
  await storage.removeItem('keypair')
  cachedKeyPair = null
}

export function clearDevModeKeysCache(): void {
  cachedKeyPair = null
}
