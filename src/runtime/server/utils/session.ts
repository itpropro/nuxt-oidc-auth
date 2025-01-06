import type { H3Event, SessionConfig } from 'h3'
import type { AuthSession, AuthSessionConfig, PersistentSession, ProviderKeys, ProviderSessionConfig, UserSession } from '../../types'
import type { OidcProviderConfig } from './provider'
import { useRuntimeConfig, useStorage } from '#imports'
import { defu } from 'defu'
import { createError, deleteCookie, sendRedirect, useSession } from 'h3'
import { createHooks } from 'hookable'
import * as providerPresets from '../../providers'
import { configMerger, refreshAccessToken, useOidcLogger } from './oidc'
import { decryptToken, encryptToken } from './security'

const sessionName = 'nuxt-oidc-auth'
let sessionConfig: Pick<SessionConfig, 'name' | 'password'> & AuthSessionConfig
const providerSessionConfigs: Record<ProviderKeys, ProviderSessionConfig> = {} as any

export interface SessionHooks {
  /**
   * Called when fetching the session from the API
   */
  fetch: (session: UserSession, event: H3Event) => void | Promise<void>
  /**
   * Called before clearing the session
   */
  clear: (event: H3Event) => void | Promise<void>
  /**
   * Called before refreshing the session
   */
  refresh: (session: UserSession, event: H3Event) => void | Promise<void>
}

export async function useAuthSession(event: H3Event, maxAge: number = 300) {
  const session = await useSession<AuthSession>(event, {
    name: 'oidc',
    password: process.env.NUXT_OIDC_AUTH_SESSION_SECRET as string,
    maxAge,
  })
  return session
}

export const sessionHooks = createHooks<SessionHooks>()

/**
 * Set a user session
 * @param event
 * @param data User session data, please only store public information since it can be decoded with API calls
 */
export async function setUserSession(event: H3Event, data: UserSession) {
  const session = await _useSession(event)

  await session.update(defu(data, session.data))

  return session.data
}

export async function clearUserSession(event: H3Event, skipHook: boolean = false) {
  const session = await _useSession(event)
  await useStorage('oidc').removeItem(session.id as string)

  if (!skipHook)
    await sessionHooks.callHookParallel('clear', event)

  await session.clear()
  deleteCookie(event, sessionName)
}

export async function refreshUserSession(event: H3Event) {
  const logger = useOidcLogger()
  const session = await _useSession(event)
  const persistentSession = await useStorage('oidc').getItem<PersistentSession>(session.id as string) as PersistentSession | null

  if (!session.data.canRefresh || !persistentSession?.refreshToken) {
    logger.warn('No refresh token')
    return
  }

  // Refresh the access token
  const tokenKey = process.env.NUXT_OIDC_TOKEN_KEY as string
  const refreshToken = await decryptToken(persistentSession.refreshToken, tokenKey)

  const provider = session.data.provider as ProviderKeys
  const config = configMerger(useRuntimeConfig().oidc.providers[provider] as OidcProviderConfig, providerPresets[provider])

  let tokenRefreshResponse
  try {
    tokenRefreshResponse = await refreshAccessToken(refreshToken, config as OidcProviderConfig)
  }
  catch (error) {
    logger.error(error)
    return sendRedirect(event, `/auth/${provider}/logout`)
  }

  const { user, tokens, expiresIn, parsedAccessToken } = tokenRefreshResponse

  // Replace the session storage

  const updatedPersistentSession: PersistentSession = {
    exp: parsedAccessToken.exp || Math.trunc(Date.now() / 1000) + Number.parseInt(expiresIn),
    iat: parsedAccessToken.iat || Math.trunc(Date.now() / 1000),
    accessToken: await encryptToken(tokens.accessToken, tokenKey),
    refreshToken: await encryptToken(tokens.refreshToken, tokenKey),
    ...tokens.idToken && { idToken: await encryptToken(tokens.idToken, tokenKey) },
  }

  await useStorage('oidc').setItem<PersistentSession>(session.id as string, updatedPersistentSession)
  const { accessToken: _accessToken, idToken: _idToken, ...userWithoutToken } = user

  await session.update(defu(userWithoutToken as UserSession, session.data))

  return {
    ...session.data,
    ...(tokens.accessToken && (useRuntimeConfig(event).oidc.providers[provider]?.exposeAccessToken || providerPresets[provider].exposeAccessToken)) && { accessToken: tokens.accessToken },
    ...(tokens.idToken && (useRuntimeConfig(event).oidc.providers[provider]?.exposeIdToken || providerPresets[provider].exposeIdToken)) && { idToken: tokens.idToken },
  }
}

// Deprecated, please use getUserSession
export async function requireUserSession(event: H3Event) {
  return await getUserSession(event)
}

export async function getUserSession(event: H3Event) {
  const logger = useOidcLogger()
  const session = await _useSession(event)
  const userSession = session.data

  if (Object.keys(userSession).length === 0) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }

  const provider = userSession.provider as ProviderKeys

  // Expiration check
  if (providerSessionConfigs[provider]?.expirationCheck) {
    const sessionId = session.id
    const persistentSession = await useStorage('oidc').getItem<PersistentSession>(sessionId as string) as PersistentSession | null
    if (!persistentSession)
      logger.warn('Persistent user session not found')

    let expired = true
    if (persistentSession) {
      expired = persistentSession?.exp <= (Math.trunc(Date.now() / 1000) + (providerSessionConfigs[provider].expirationThreshold && typeof providerSessionConfigs[provider].expirationThreshold === 'number' ? providerSessionConfigs[provider].expirationThreshold : 0))
    }
    else if (userSession) {
      expired = userSession?.expireAt <= (Math.trunc(Date.now() / 1000) + (providerSessionConfigs[provider].expirationThreshold && typeof providerSessionConfigs[provider].expirationThreshold === 'number' ? providerSessionConfigs[provider].expirationThreshold : 0))
    }
    else {
      throw createError({
        statusCode: 401,
        message: 'Session not found',
      })
    }
    if (expired) {
      logger.info('Session expired')
      // Automatic token refresh
      if (providerSessionConfigs[provider].automaticRefresh) {
        await refreshUserSession(event)
        return userSession
      }
      await clearUserSession(event)
      throw createError({
        statusCode: 401,
        message: 'Session expired',
      })
    }
  }
  // Expose tokens if configured
  if (useRuntimeConfig(event).oidc.providers[provider]?.exposeAccessToken || providerPresets[provider].exposeAccessToken) {
    const persistentSession = await useStorage('oidc').getItem<PersistentSession>(session.id as string) as PersistentSession | null
    const tokenKey = process.env.NUXT_OIDC_TOKEN_KEY as string
    if (persistentSession)
      userSession.accessToken = await decryptToken(persistentSession.accessToken, tokenKey)
  }
  if (useRuntimeConfig(event).oidc.providers[provider]?.exposeIdToken || providerPresets[provider].exposeIdToken) {
    const persistentSession = await useStorage('oidc').getItem<PersistentSession>(session.id as string) as PersistentSession | null
    const tokenKey = process.env.NUXT_OIDC_TOKEN_KEY as string
    if (persistentSession?.idToken)
      userSession.idToken = await decryptToken(persistentSession.idToken, tokenKey) || undefined
  }
  return userSession
}

export async function getUserSessionId(event: H3Event) {
  return (await _useSession(event)).id as string
}

function _useSession(event: H3Event) {
  if (!sessionConfig || !Object.keys(providerSessionConfigs).length) {
    // Merge sessionConfig
    sessionConfig = defu({ password: process.env.NUXT_OIDC_SESSION_SECRET!, name: sessionName }, useRuntimeConfig(event).oidc.session)
    // Merge providerSessionConfigs
    Object.keys(useRuntimeConfig(event).oidc.providers).map(
      key => key as ProviderKeys,
    ).forEach(
      key => providerSessionConfigs[key] = defu(useRuntimeConfig(event).oidc.providers[key]?.sessionConfiguration, providerPresets[key].sessionConfiguration, {
        automaticRefresh: useRuntimeConfig(event).oidc.session.automaticRefresh,
        expirationCheck: useRuntimeConfig(event).oidc.session.expirationCheck,
        expirationThreshold: useRuntimeConfig(event).oidc.session.expirationThreshold,
      }) as ProviderSessionConfig,
    )
  }
  return useSession<UserSession>(event, sessionConfig)
}
