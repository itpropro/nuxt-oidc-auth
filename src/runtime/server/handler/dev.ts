import type { OAuthConfig, UserSession } from '../../types'
import type { H3Event } from 'h3'
import { useRuntimeConfig } from '#imports'
import { createError, deleteCookie, eventHandler, getQuery, sendRedirect } from 'h3'
import { importJWK, SignJWT } from 'jose'
import { getOrCreateDevModeKeyPair } from '../utils/devModeKeys'
import { useOidcLogger } from '../utils/oidc'
import { sanitizeCallbackRedirectUrl, withAppBase } from '../utils/redirect'
import { generateRandomUrlSafeString } from '../utils/security'
import { setUserSession, useAuthSession } from '../utils/session'
import { isProductionEnvironment } from '../../utils/environment'

export function devEventHandler({ onSuccess }: OAuthConfig<UserSession>) {
  const logger = useOidcLogger()
  return eventHandler(async (event: H3Event) => {
    // Primary guard is the build-immutable dev flag: a production build has import.meta.dev === false,
    // so this branch is statically false and tree-shaken and the dev auth bypass cannot be reached.
    // The runtime NODE_ENV check stays as defense in depth for a dev server run against a prod env.
    if (!import.meta.dev || isProductionEnvironment()) {
      throw createError({ statusCode: 404, message: 'Not Found' })
    }
    logger.warn('Using dev auth handler with static auth information')

    const runtimeConfig = useRuntimeConfig().oidc
    const config = runtimeConfig.devMode
    const session = await useAuthSession(event, runtimeConfig.session?.maxAuthSessionAge)
    const query = getQuery(event)
    const callbackRedirectUrl = sanitizeCallbackRedirectUrl(
      Array.isArray(query.callbackRedirectUrl)
        ? query.callbackRedirectUrl[0]
        : query.callbackRedirectUrl,
    )

    const timestamp = Math.trunc(Date.now() / 1000)
    const user: UserSession = {
      canRefresh: false,
      loggedInAt: timestamp,
      updatedAt: timestamp,
      expireAt: timestamp + 86400,
      provider: 'dev',
      userName: config?.userName || 'Nuxt OIDC Auth Dev',
      ...(config?.userInfo && { userInfo: config.userInfo }),
      ...(config?.idToken && { idToken: config.idToken }),
      ...(config?.accessToken && { accessToken: config.accessToken }),
      ...(config?.claims && { claims: config.claims }),
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
      } else {
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
      callbackRedirectUrl,
    })
  })
}

export default devEventHandler({
  async onSuccess(event, { user, callbackRedirectUrl }) {
    await setUserSession(event, user as UserSession)
    return sendRedirect(event, withAppBase(callbackRedirectUrl || '/'))
  },
})
