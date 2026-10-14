import type { EventHandler, EventHandlerRequest, H3Event } from 'h3'
import { createError, deleteCookie, eventHandler, getQuery, sendRedirect } from 'h3'
import { importJWK, SignJWT } from 'jose'

import { useRuntimeConfig } from '#imports'

import type { OAuthConfig, UserSession } from '../../types'
import { isProductionEnvironment } from '../../utils/environment'
import { getOrCreateDevModeKeyPair } from '../utils/devModeKeys'
import { useOidcLogger } from '../utils/logger'
import { sanitizeCallbackRedirectUrl, withAppBase } from '../utils/redirect'
import { generateRandomUrlSafeString } from '../utils/security'
import { setUserSession, useAuthSession } from '../utils/session'

export function devEventHandler({
  onSuccess,
}: OAuthConfig<UserSession>): EventHandler<EventHandlerRequest, Promise<void>> {
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
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- Runtime request adapters can omit session configuration; retain the default auth-session duration.
    const session = await useAuthSession(event, runtimeConfig.session?.maxAuthSessionAge)
    const query = getQuery(event)
    const callbackRedirectUrl = sanitizeCallbackRedirectUrl(
      Array.isArray(query['callbackRedirectUrl'])
        ? query['callbackRedirectUrl'][0]
        : query['callbackRedirectUrl'],
    )

    const timestamp = Math.trunc(Date.now() / 1000)
    const user: UserSession = {
      canRefresh: false,
      loggedInAt: timestamp,
      updatedAt: timestamp,
      expireAt: timestamp + 86400,
      provider: 'dev',
      userName:
        config?.userName !== undefined && config.userName !== ''
          ? config.userName
          : 'Nuxt OIDC Auth Dev',
      ...(config?.userInfo && { userInfo: config.userInfo }),
      ...(config?.idToken !== undefined && config.idToken !== '' && { idToken: config.idToken }),
      ...(config?.accessToken !== undefined &&
        config.accessToken !== '' && { accessToken: config.accessToken }),
      ...(config?.claims && { claims: config.claims }),
    }

    if (config?.generateAccessToken === true) {
      let key
      let alg: string
      let kid: string | undefined

      if (config.tokenAlgorithm === 'symmetric') {
        alg = 'HS256'
        key = new TextEncoder().encode(generateRandomUrlSafeString())
      } else {
        const keyPair = await getOrCreateDevModeKeyPair()
        key = await importJWK(keyPair.privateKey, 'RS256')
        alg = 'RS256'
        kid = keyPair.kid
      }

      const jwt = await new SignJWT(config.claims ?? {})
        .setProtectedHeader({ alg, ...(kid !== undefined && kid !== '' && { kid }) })
        .setIssuedAt()
        .setIssuer(
          config.issuer !== undefined && config.issuer !== ''
            ? config.issuer
            : 'nuxt:oidc:auth:issuer',
        )
        .setAudience(
          config.audience !== undefined && config.audience !== ''
            ? config.audience
            : 'nuxt:oidc:auth:audience',
        )
        .setExpirationTime('24h')
        .setSubject(
          config.subject !== undefined && config.subject !== ''
            ? config.subject
            : 'nuxt:oidc:auth:subject',
        )
        .sign(key)
      user.accessToken = jwt
    }

    await session.clear()
    deleteCookie(event, 'oidc')

    await onSuccess(event, {
      user,
      callbackRedirectUrl,
    })
  })
}

export default devEventHandler({
  async onSuccess(event, { user, callbackRedirectUrl }) {
    if (user !== null) {
      await setUserSession(event, user)
    }
    await sendRedirect(
      event,
      withAppBase(
        callbackRedirectUrl !== undefined && callbackRedirectUrl !== '' ? callbackRedirectUrl : '/',
      ),
    )
  },
})
