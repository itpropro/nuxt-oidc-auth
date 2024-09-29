import type { H3Event } from 'h3'
import type { OAuthConfig, UserSession } from '../../types'
import { useRuntimeConfig } from '#imports'
import { deleteCookie, eventHandler, sendRedirect } from 'h3'
import { SignJWT } from 'jose'
import { subtle } from 'uncrypto'
import { useOidcLogger } from '../utils/oidc'
import { generateRandomUrlSafeString } from '../utils/security'
import { setUserSession, useAuthSession } from '../utils/session'

export function devEventHandler({ onSuccess }: OAuthConfig<UserSession>) {
  const logger = useOidcLogger()
  return eventHandler(async (event: H3Event) => {
    logger.warn('Using dev auth handler with static auth information')

    const session = await useAuthSession(event)

    // Construct user object
    const timestamp = Math.trunc(Date.now() / 1000) // Use seconds instead of milliseconds to align with JWT
    const user: UserSession = {
      canRefresh: false,
      loggedInAt: timestamp,
      updatedAt: timestamp,
      expireAt: timestamp + 86400, // Adding one day
      provider: 'dev',
      userName: useRuntimeConfig().oidc.devMode?.userName || 'Nuxt OIDC Auth Dev',
      ...useRuntimeConfig().oidc.devMode?.userInfo && { userInfo: useRuntimeConfig().oidc.devMode?.userInfo },
      ...useRuntimeConfig().oidc.devMode?.idToken && { idToken: useRuntimeConfig().oidc.devMode?.idToken },
      ...useRuntimeConfig().oidc.devMode?.accessToken && { accessToken: useRuntimeConfig().oidc.devMode?.accessToken },
      ...useRuntimeConfig().oidc.devMode?.claims && { claims: useRuntimeConfig().oidc.devMode?.claims },
    }

    // Generate JWT dev token - Keys are only used in local dev mode, these are statically generated unsafe keys.
    if (useRuntimeConfig().oidc.devMode?.generateAccessToken) {
      let key
      let alg
      if (useRuntimeConfig().oidc.devMode?.tokenAlgorithm === 'asymmetric') {
        alg = 'RS256'
        const keyPair = await subtle.generateKey(
          {
            name: 'RSASSA-PKCS1-v1_5',
            modulusLength: 2048,
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
            hash: { name: 'SHA-256' },
          },
          true,
          ['sign', 'verify'],
        )
        key = keyPair.privateKey
      }
      else {
        alg = 'HS256'
        key = new TextEncoder().encode(
          generateRandomUrlSafeString(),
        )
      }
      const jwt = await new SignJWT(useRuntimeConfig().oidc.devMode?.claims || {})
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setIssuer(useRuntimeConfig().oidc.devMode?.issuer || 'nuxt:oidc:auth:issuer')
        .setAudience(useRuntimeConfig().oidc.devMode?.audience || 'nuxt:oidc:auth:audience')
        .setExpirationTime('24h')
        .setSubject(useRuntimeConfig().oidc.devMode?.subject || 'nuxt:oidc:auth:subject')
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
