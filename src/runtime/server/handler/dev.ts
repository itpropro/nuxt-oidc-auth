import type { OAuthConfig, UserSession } from '#oidc-auth'
import type { H3Event } from 'h3'
import { useRuntimeConfig } from '#imports'
import { deleteCookie, eventHandler, sendRedirect } from 'h3'
import { importJWK, SignJWT } from 'jose'
import { useOidcLogger } from '../utils/oidc'
import { generateRandomUrlSafeString } from '../utils/security'
import { getOrCreateDevModeKeyPair } from '../utils/devModeKeys'
import { setUserSession, useAuthSession } from '../utils/session'

export function devEventHandler({ onSuccess }: OAuthConfig<UserSession>) {
  const logger = useOidcLogger()
  return eventHandler(async (event: H3Event) => {
    logger.warn('Using dev auth handler with static auth information')

    const session = await useAuthSession(event)
    const config = useRuntimeConfig().oidc.devMode

    const timestamp = Math.trunc(Date.now() / 1000)
    const user: UserSession = {
      canRefresh: false,
      loggedInAt: timestamp,
      updatedAt: timestamp,
      expireAt: timestamp + 86400,
      provider: 'dev',
      userName: config?.userName || 'Nuxt OIDC Auth Dev',
      ...config?.userInfo && { userInfo: config.userInfo },
      ...config?.idToken && { idToken: config.idToken },
      ...config?.accessToken && { accessToken: config.accessToken },
      ...config?.claims && { claims: config.claims },
    }

    if (config?.generateAccessToken) {
      let key
      let alg: string
      let kid: string | undefined

      if (config?.tokenAlgorithm !== 'symmetric') {
        const keyPair = await getOrCreateDevModeKeyPair()
        key = await importJWK(keyPair.privateKey, 'RS256')
        alg = 'RS256'
        kid = keyPair.kid
      }
      else {
        alg = 'HS256'
        key = new TextEncoder().encode(generateRandomUrlSafeString())
      }

      const jwt = await new SignJWT(config?.claims || {})
        .setProtectedHeader({ alg, ...(kid && { kid }) })
        .setIssuedAt()
        .setIssuer(config?.issuer || 'nuxt:oidc:auth:issuer')
        .setAudience(config?.audience || 'nuxt:oidc:auth:audience')
        .setExpirationTime('24h')
        .setSubject(config?.subject || 'nuxt:oidc:auth:subject')
        .sign(key)
      user.accessToken = jwt
    }

    await session.clear()
    deleteCookie(event, 'oidc')

    return onSuccess(event, {
      user,
    })
  })
}

export default devEventHandler({
  async onSuccess(event, { user }) {
    await setUserSession(event, user as UserSession)
    return sendRedirect(event, '/')
  },
})
