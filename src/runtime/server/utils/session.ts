import { defu } from 'defu'
import type { H3Event, SessionConfig, SessionManager } from 'h3'
import { createError, deleteCookie, getCookie, sendRedirect, unsealSession, useSession } from 'h3'
import { createHooks } from 'hookable'
import { useStorage } from 'nitropack/runtime'

import { useRuntimeConfig } from '#imports'

import * as providerPresets from '../../providers'
import type {
  AuthSession,
  AuthSessionConfig,
  PersistentSession,
  ProviderKeys,
  ProviderSessionConfig,
  UserSession,
} from '../../types'
import { isProductionEnvironment } from '../../utils/environment'
import {
  formatProviderConfigValidation,
  resolveEffectiveProviderConfig,
  resolveProviderConfig,
  validateProviderConfig,
} from './config'
import { useOidcLogger } from './logger'
import type { OidcProviderConfig } from './provider'
import { isOidcProvider } from './provider-config'
import { withAppBase } from './redirect'
import { decryptToken, encryptToken, parseJwtToken } from './security'
import { resolveMissingPersistentSessionMode } from './session-options'
import { refreshAccessToken } from './token-refresh'
import type { IdTokenContinuityClaims } from './token-validation'

const DEFAULT_SESSION_NAME = 'nuxt-oidc-auth'
const TOKEN_DERIVED_USER_SESSION_FIELDS = [
  'accessToken',
  'claims',
  'idToken',
  'userInfo',
  'userName',
  'expireAt',
  'canRefresh',
  'tokensStored',
  'provider',
  'loggedInAt',
  'updatedAt',
] as const satisfies readonly (keyof UserSession)[]
const REFRESHED_USER_SESSION_FIELDS = [
  'accessToken',
  'claims',
  'idToken',
  'expireAt',
  'canRefresh',
  'updatedAt',
] as const satisfies readonly (keyof UserSession)[]
let sessionConfig: (Pick<SessionConfig, 'name' | 'password'> & AuthSessionConfig) | undefined
const providerSessionConfigs: Partial<Record<ProviderKeys, ProviderSessionConfig>> = {}
const presets = { ...providerPresets }

export type SessionErrorBehavior = 'throw' | 'redirect'

export interface SessionBehaviorOptions {
  errorBehavior?: SessionErrorBehavior
}

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

export interface LogoutHooks {
  // oxlint-disable-next-line typescript/consistent-indexed-object-style -- Preserve declaration merging for this exported interface.
  [key: string]: () => void | Promise<void>
}

function resolveRefreshExpiration(
  tokenExpiration: number | undefined,
  expiresIn: string | undefined,
  currentExpiration: number,
  now: number,
): number {
  if (tokenExpiration !== undefined) {
    if (Number.isFinite(tokenExpiration)) {
      return tokenExpiration
    }
    throw new Error('Refreshed access token expiration must be finite')
  }

  const providerExpiresIn = expiresIn === undefined ? Number.NaN : Number(expiresIn)
  if (Number.isFinite(providerExpiresIn) && providerExpiresIn >= 0) {
    return now + providerExpiresIn
  }
  if (Number.isFinite(currentExpiration)) {
    return currentExpiration
  }
  throw new Error('Token refresh did not provide a finite expiration')
}

function createIdTokenContinuityClaims(
  payload: ReturnType<typeof parseJwtToken>,
): IdTokenContinuityClaims {
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new Error('Original ID token sub must be a non-empty string')
  }
  if (typeof payload.iss !== 'string' || payload.iss.length === 0) {
    throw new Error('Original ID token iss must be a non-empty string')
  }
  const audiences = typeof payload.aud === 'string' ? [payload.aud] : payload.aud
  if (
    !Array.isArray(audiences) ||
    audiences.length === 0 ||
    !audiences.every((audience) => typeof audience === 'string' && audience.length > 0)
  ) {
    throw new Error('Original ID token aud must contain non-empty strings')
  }
  if (payload['azp'] !== undefined && typeof payload['azp'] !== 'string') {
    throw new Error('Original ID token azp must be a string')
  }
  if (payload['auth_time'] !== undefined && typeof payload['auth_time'] !== 'number') {
    throw new Error('Original ID token auth_time must be a number')
  }
  return {
    audiences: [...new Set(audiences)],
    authenticationTime: payload['auth_time'],
    authorizedParty: payload['azp'],
    issuer: payload.iss,
    subject: payload.sub,
  }
}

export async function useAuthSession(
  event: H3Event,
  maxAge = 300,
): Promise<SessionManager<AuthSession>> {
  const session = await useSession<AuthSession>(event, {
    name: 'oidc',
    password: getRequiredSecret('NUXT_OIDC_AUTH_SESSION_SECRET'),
    maxAge,
  })
  return session
}

export const sessionHooks = createHooks<SessionHooks>()
export const logoutHooks = createHooks<LogoutHooks>()

/**
 * Set a user session
 * @param event
 * @param data User session data, please only store public information since it can be decoded with API calls
 */
export async function setUserSession(event: H3Event, data: UserSession): Promise<UserSession> {
  const session = await useUserSession(event)

  await session.update(defu(data, session.data))

  return session.data
}

export async function replaceTokenDerivedUserSession(
  event: H3Event,
  data: UserSession,
): Promise<UserSession> {
  const session = await useUserSession(event)

  clearUserSessionFields(session.data, TOKEN_DERIVED_USER_SESSION_FIELDS)
  await session.update(data)

  return session.data
}

export async function clearUserSession(event: H3Event, skipHook = false): Promise<void> {
  const session = await useUserSession(event)
  const sessionId = resolveSessionId(session)
  let singleSignOutSessionId: string | undefined
  if (Boolean(session.data.singleSignOut) && session.data.tokensStored !== false) {
    const persistentSession = await useStorage('oidc').getItem<PersistentSession>(sessionId)
    singleSignOutSessionId = persistentSession?.singleSignOutId
  }
  await useStorage('oidc').removeItem(sessionId)

  if (!skipHook) {
    await sessionHooks.callHookParallel('clear', event)
  }

  await session.clear()
  deleteCookie(event, resolveSessionName(sessionConfig))

  if (singleSignOutSessionId !== undefined && singleSignOutSessionId.length > 0) {
    await logoutHooks.callHookParallel(singleSignOutSessionId)
  } else {
    await logoutHooks.callHookParallel(sessionId)
  }
}

async function handleSessionError(
  event: H3Event,
  message: string,
  options: SessionBehaviorOptions = {},
): Promise<never> {
  if (options.errorBehavior === 'redirect') {
    await sendRedirect(event, withAppBase('/'), 302)
    // SAFETY: H3 resolves with void after sending the redirect. Preserve the legacy non-returning API type.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Changing redirect return types requires a public API decision.
    return undefined as never
  }

  throw createError({
    statusCode: 401,
    message,
  })
}

export async function refreshUserSession(
  event: H3Event,
  options: SessionBehaviorOptions = {},
): Promise<UserSession> {
  const session = await useUserSession(event)
  const provider = session.data.provider
  const sessionId = resolveSessionId(session)
  const persistentSession = await useStorage('oidc').getItem<PersistentSession>(sessionId)
  const logger = useOidcLogger()

  if (!session.data.canRefresh || !persistentSession?.refreshToken || !isOidcProvider(provider)) {
    await clearUserSession(event)
    return await handleSessionError(
      event,
      `[${provider}] Token refresh failed: No refresh token`,
      options,
    )
  }

  // Refresh the access token
  let config: OidcProviderConfig
  try {
    config = await resolveEffectiveProviderConfig(
      useRuntimeConfig().oidc.providers[provider],
      presets[provider],
    )
  } catch (error) {
    logger.error(`[${provider}] Provider discovery failed: ${String(error)}`)
    await clearUserSession(event)
    return await handleSessionError(event, `[${provider}] Provider discovery failed`, options)
  }
  const validationResult = validateProviderConfig(config, 'refresh')
  if (!validationResult.valid) {
    logger.error(
      `[${provider}] Invalid configuration: ${formatProviderConfigValidation(validationResult)}`,
    )
    await clearUserSession(event)
    return await handleSessionError(event, `[${provider}] Invalid configuration`, options)
  }

  let tokenRefreshResponse: Awaited<ReturnType<typeof refreshAccessToken>>
  let tokenKey: string
  try {
    tokenKey = getRequiredSecret('NUXT_OIDC_TOKEN_KEY')
    const refreshToken = await decryptToken(persistentSession.refreshToken, tokenKey)
    let expectedIdTokenClaims: IdTokenContinuityClaims | undefined
    if (config.tokenValidationMode === 'strict' && Boolean(config.validateIdToken)) {
      if (!persistentSession.idToken) {
        throw new Error('Strict refresh validation requires the original ID token')
      }
      const originalIdToken = await decryptToken(persistentSession.idToken, tokenKey)
      expectedIdTokenClaims = createIdTokenContinuityClaims(parseJwtToken(originalIdToken))
    }
    tokenRefreshResponse = await refreshAccessToken(refreshToken, config, expectedIdTokenClaims)
  } catch (error) {
    logger.error(`[${provider}] Token refresh failed: ${String(error)}`)
    await clearUserSession(event)
    return await handleSessionError(event, `[${provider}] Token refresh failed`, options)
  }

  const { user, tokens, expiresIn, parsedAccessToken } = tokenRefreshResponse
  const timestamp = Math.trunc(Date.now() / 1000)
  let refreshedExpiration: number
  try {
    refreshedExpiration = resolveRefreshExpiration(
      parsedAccessToken.exp,
      expiresIn,
      session.data.expireAt,
      timestamp,
    )
  } catch (error) {
    logger.error(`[${provider}] Token refresh failed: ${String(error)}`)
    await clearUserSession(event)
    return await handleSessionError(event, `[${provider}] Token refresh failed`, options)
  }
  user.expireAt = refreshedExpiration

  // Replace the session storage

  const updatedPersistentSession: PersistentSession = {
    createdAt: persistentSession.createdAt,
    updatedAt: new Date(),
    exp: refreshedExpiration,
    iat: parsedAccessToken.iat ?? timestamp,
    accessToken: await encryptToken(tokens.accessToken, tokenKey),
    refreshToken: await encryptToken(tokens.refreshToken, tokenKey),
    ...(tokens.idToken.length > 0 && { idToken: await encryptToken(tokens.idToken, tokenKey) }),
    ...(persistentSession.singleSignOutId !== undefined &&
      persistentSession.singleSignOutId.length > 0 && {
        singleSignOutId: persistentSession.singleSignOutId,
      }),
  }

  await useStorage('oidc').setItem<PersistentSession>(sessionId, updatedPersistentSession)
  const { accessToken: _accessToken, idToken: _idToken, ...userWithoutToken } = user

  // Slide the cookie expiry forward by resetting h3's internal createdAt.
  // Without this, h3 computes Expires from the original login timestamp,
  // causing the session cookie to expire even after successful token refresh.
  const sessionName = resolveSessionName(sessionConfig)
  const rawSession = event.context.sessions?.[sessionName]
  if (rawSession) {
    rawSession.createdAt = Date.now()
  }

  clearUserSessionFields(session.data, REFRESHED_USER_SESSION_FIELDS)
  await session.update(userWithoutToken)

  return {
    ...session.data,
    ...(tokens.accessToken.length > 0 &&
      Boolean(config.exposeAccessToken) && { accessToken: tokens.accessToken }),
    ...(tokens.idToken.length > 0 && Boolean(config.exposeIdToken) && { idToken: tokens.idToken }),
  }
}

// Deprecated, please use getUserSession
export async function requireUserSession(
  event: H3Event,
  options: SessionBehaviorOptions = {},
): Promise<UserSession> {
  return await getUserSession(event, options)
}

export async function getUserSession(
  event: H3Event,
  options: SessionBehaviorOptions = {},
): Promise<UserSession> {
  const logger = useOidcLogger()
  const session = await useUserSession(event)
  const userSession = session.data

  if (Object.keys(userSession).length === 0) {
    return await handleSessionError(event, 'Unauthorized', options)
  }

  const provider = userSession.provider
  const providerSessionConfig = provider === 'dev' ? undefined : providerSessionConfigs[provider]

  // Expiration check
  if (providerSessionConfig !== undefined && Boolean(providerSessionConfig.expirationCheck)) {
    const sessionId = resolveSessionId(session)
    let persistentSession: PersistentSession | null = null
    if (userSession.canRefresh) {
      persistentSession = await useStorage('oidc').getItem<PersistentSession>(sessionId)
      if (!persistentSession) {
        const missingPersistentSessionMode = resolveMissingPersistentSessionMode(
          providerSessionConfig,
          userSession,
        )
        if (missingPersistentSessionMode === 'clear') {
          logger.info('Persistent user session not found, clearing stale session')
          await clearUserSession(event)
          return await handleSessionError(event, 'Session not found', options)
        }

        if (missingPersistentSessionMode === 'warn') {
          logger.warn('Persistent user session not found')
        }
      }
    }

    const threshold = providerSessionConfig.expirationThreshold
    const expirationThreshold =
      typeof threshold === 'number' && !Number.isNaN(threshold) ? threshold : 0
    const expireAt = persistentSession === null ? userSession.expireAt : persistentSession.exp
    const expired = expireAt <= Math.trunc(Date.now() / 1000) + expirationThreshold
    if (expired) {
      logger.info('Session expired')
      // Automatic token refresh
      if (providerSessionConfig.automaticRefresh === true) {
        return await refreshUserSession(event, options)
      }
      logger.warn('Session expired, automatic refresh disabled')
      await clearUserSession(event)
      return await handleSessionError(event, 'Session expired', options)
    }
  }

  if (provider === 'dev') {
    return userSession
  }

  // Expose tokens if configured
  if (!isOidcProvider(provider)) {
    throw createError({
      statusCode: 500,
      message: `Unknown OIDC provider: ${userSession.provider}`,
    })
  }
  const runtimeProviderConfig = useRuntimeConfig(event).oidc.providers[provider]
  // App-owned handlers can set sessions for providers the module does not configure.
  // Nothing opted these sessions into token exposure, so return them without stored tokens.
  if (!runtimeProviderConfig) {
    return userSession
  }
  const providerPreset = presets[provider]
  const providerConfig = resolveProviderConfig(runtimeProviderConfig, providerPreset)
  const { exposeAccessToken, exposeIdToken } = providerConfig

  if (Boolean(exposeAccessToken) || Boolean(exposeIdToken)) {
    const persistentSession = await useStorage('oidc').getItem<PersistentSession>(
      resolveSessionId(session),
    )
    try {
      if (Boolean(exposeAccessToken) && persistentSession) {
        userSession.accessToken = await decryptToken(
          persistentSession.accessToken,
          getRequiredSecret('NUXT_OIDC_TOKEN_KEY'),
        )
      }
      if (Boolean(exposeIdToken) && persistentSession?.idToken) {
        userSession.idToken =
          (await decryptToken(
            persistentSession.idToken,
            getRequiredSecret('NUXT_OIDC_TOKEN_KEY'),
          )) || undefined
      }
    } catch {
      return await handleSessionError(event, 'Session tokens not available', options)
    }
  }
  return userSession
}

export async function hasValidUserSession(event: H3Event): Promise<boolean> {
  const session = await useUserSession(event)
  const userSession = session.data
  const provider = userSession.provider
  if (
    typeof provider !== 'string' ||
    provider.length === 0 ||
    typeof userSession.canRefresh !== 'boolean' ||
    typeof userSession.expireAt !== 'number'
  ) {
    return false
  }

  const providerSessionConfig = provider === 'dev' ? undefined : providerSessionConfigs[provider]
  if (provider !== 'dev' && !providerSessionConfig) {
    return false
  }

  const persistentSession = userSession.canRefresh
    ? await useStorage('oidc').getItem<PersistentSession>(resolveSessionId(session))
    : null
  if (userSession.canRefresh && !persistentSession) {
    return false
  }

  const expirationCheck = provider === 'dev' || providerSessionConfig?.expirationCheck
  const expireAt = persistentSession?.exp ?? userSession.expireAt
  return expirationCheck !== true || expireAt > Math.trunc(Date.now() / 1000)
}

export async function getUserSessionId(event: H3Event): Promise<string> {
  return resolveSessionId(await useUserSession(event))
}

/**
 * Read the ID token from the encrypted persistent session storage without exposing it to the client.
 * Used server-side (for example to build the RP-initiated logout id_token_hint) so it works
 * independently of the exposeIdToken flag, which only controls client visibility.
 */
export async function getPersistedIdToken(event: H3Event): Promise<string | undefined> {
  const session = await useUserSession(event)
  if (session.data.tokensStored === false) {
    return undefined
  }
  const persistentSession = await useStorage('oidc').getItem<PersistentSession>(
    resolveSessionId(session),
  )
  if (!persistentSession?.idToken) {
    return undefined
  }
  // An unreadable token, for example after a token key change, is treated as missing
  try {
    return (
      (await decryptToken(persistentSession.idToken, getRequiredSecret('NUXT_OIDC_TOKEN_KEY'))) ||
      undefined
    )
  } catch {
    return undefined
  }
}

/**
 * Get the access token of the current user session for server-side requests to downstream APIs.
 * Validates and automatically refreshes the session like getUserSession, independently of the
 * exposeAccessToken flag. Do not return the token to the client.
 * Throws an HTTP 401 error when the session is invalid or no unexpired, readable access token is stored.
 */
export async function getAccessToken(event: H3Event): Promise<string> {
  const userSession = await getUserSession(event)
  if (userSession.provider === 'dev') {
    if (userSession.accessToken !== undefined && userSession.accessToken.length > 0) {
      return userSession.accessToken
    }
    return await handleSessionError(event, 'Access token not available')
  }
  // A stateless sign-in can reuse a session id that still has tokens from an earlier login.
  if (!(userSession.tokensStored ?? userSession.canRefresh)) {
    return await handleSessionError(event, 'Access token not available')
  }

  const persistentSession = await useStorage('oidc').getItem<PersistentSession>(
    await getUserSessionId(event),
  )
  if (!persistentSession?.accessToken) {
    return await handleSessionError(event, 'Access token not available')
  }
  const exp = persistentSession.exp
  if (!Number.isFinite(exp) || exp <= Math.trunc(Date.now() / 1000)) {
    return await handleSessionError(event, 'Access token expired')
  }
  let accessToken: string
  try {
    accessToken = await decryptToken(
      persistentSession.accessToken,
      getRequiredSecret('NUXT_OIDC_TOKEN_KEY'),
    )
  } catch {
    return await handleSessionError(event, 'Access token not available')
  }
  return accessToken || (await handleSessionError(event, 'Access token not available'))
}

export async function hasEligibleSingleSignOutSessionCookie(event: H3Event): Promise<boolean> {
  const runtimeConfig = useRuntimeConfig(event).oidc
  const config = runtimeConfig.session
  const sealedSession = getCookie(event, resolveSessionName(config))
  if (sealedSession === undefined || sealedSession.length === 0) {
    return false
  }

  try {
    const session = await unsealSession(event, resolveSessionConfig(config), sealedSession)
    const data: Partial<UserSession> | undefined = session.data
    const provider = data?.provider
    if (
      typeof session.id !== 'string' ||
      session.id.length === 0 ||
      !data ||
      !isOidcProvider(provider) ||
      !Object.hasOwn(runtimeConfig.providers, provider) ||
      typeof data.canRefresh !== 'boolean' ||
      typeof data.expireAt !== 'number' ||
      !Number.isFinite(data.expireAt) ||
      data.singleSignOut !== true
    ) {
      return false
    }

    const providerConfig = resolveProviderConfig(
      runtimeConfig.providers[provider],
      presets[provider],
    )
    const providerSessionConfig = defu<ProviderSessionConfig, [ProviderSessionConfig]>(
      providerConfig.sessionConfiguration,
      {
        automaticRefresh: config.automaticRefresh,
        expirationCheck: config.expirationCheck,
        expirationThreshold: config.expirationThreshold,
      },
    )
    const expirationThreshold =
      typeof providerSessionConfig.expirationThreshold === 'number'
        ? providerSessionConfig.expirationThreshold
        : 0
    const expired = data.expireAt <= Math.trunc(Date.now() / 1000) + expirationThreshold

    return (
      providerSessionConfig.expirationCheck !== true ||
      !expired ||
      (data.canRefresh && providerSessionConfig.automaticRefresh === true)
    )
  } catch {
    return false
  }
}

export async function getSingleSignOutSessionId(event: H3Event): Promise<string | undefined> {
  const session = await useUserSession(event)
  if (session.data.singleSignOut !== true) {
    return undefined
  }
  if (session.data.tokensStored === false) {
    return resolveSessionId(session)
  }
  const persistentSession = await useStorage('oidc').getItem<PersistentSession>(
    resolveSessionId(session),
  )
  if (session.data.canRefresh && !persistentSession) {
    const provider = session.data.provider
    const providerSessionConfig = provider === 'dev' ? undefined : providerSessionConfigs[provider]
    if (resolveMissingPersistentSessionMode(providerSessionConfig, session.data) === 'clear') {
      await clearUserSession(event)
    }
    return undefined
  }
  const singleSignOutId = persistentSession?.singleSignOutId
  return singleSignOutId !== undefined && singleSignOutId.length > 0 ? singleSignOutId : session.id
}

function resolveSessionName(config: AuthSessionConfig | undefined): string {
  const customName = config?.cookieName
  return customName !== undefined && customName.length > 0 ? customName : DEFAULT_SESSION_NAME
}

function resolveSessionConfig(config: AuthSessionConfig) {
  if (sessionConfig) {
    return sessionConfig
  }

  sessionConfig = defu(
    {
      password: getRequiredSecret('NUXT_OIDC_SESSION_SECRET'),
      name: resolveSessionName(config),
      // Resolve the secure flag at runtime so a production deployment gets Secure cookies even when
      // the build did not run with a production NODE_ENV. Explicit config still takes precedence.
      cookie: {
        secure: config.cookie?.secure ?? isProductionEnvironment(),
      },
    },
    config,
  )
  return sessionConfig
}

function clearUserSessionFields(data: UserSession, fields: readonly (keyof UserSession)[]): void {
  for (const field of fields) {
    if (!Reflect.deleteProperty(data, field)) {
      throw new TypeError(`Cannot clear user session field: ${field}`)
    }
  }
}

async function useUserSession(event: H3Event) {
  const runtimeConfig = useRuntimeConfig(event).oidc
  const config = runtimeConfig.session
  const resolvedSessionConfig = resolveSessionConfig(config)
  if (Object.keys(providerSessionConfigs).length === 0) {
    const missingPersistentSession = config.missingPersistentSession
    // Merge providerSessionConfigs
    for (const key of Object.keys(runtimeConfig.providers)) {
      if (!isOidcProvider(key)) {
        throw createError({ statusCode: 500, message: `Unknown OIDC provider: ${key}` })
      }
      const providerConfig = resolveProviderConfig(runtimeConfig.providers[key], presets[key])
      providerSessionConfigs[key] = defu<ProviderSessionConfig, [ProviderSessionConfig]>(
        providerConfig.sessionConfiguration,
        {
          automaticRefresh: config.automaticRefresh,
          expirationCheck: config.expirationCheck,
          expirationThreshold: config.expirationThreshold,
          missingPersistentSession,
        },
      )
    }
  }
  return await useSession<UserSession>(event, resolvedSessionConfig)
}

function resolveSessionId(session: SessionManager<UserSession>): string {
  const id = session.id
  if (id === undefined) {
    throw new Error('User session ID is not available')
  }
  return id
}

function getRequiredSecret(
  name: 'NUXT_OIDC_AUTH_SESSION_SECRET' | 'NUXT_OIDC_SESSION_SECRET' | 'NUXT_OIDC_TOKEN_KEY',
): string {
  const secret = process.env[name]
  if (secret === undefined) {
    throw new Error(`${name} is not configured`)
  }
  return secret
}
