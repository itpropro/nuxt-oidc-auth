import type { H3Event } from 'h3'
import { createError, eventHandler, getQuery, getRequestHeader, sendRedirect } from 'h3'
import type { QueryObject } from 'ufo'
import { withQuery } from 'ufo'

import { useRuntimeConfig } from '#imports'

import * as providerPresets from '../../providers'
import type { AuthorizationRequest, PkceAuthorizationRequest } from '../../types'
import {
  formatProviderConfigValidation,
  resolveEffectiveProviderConfig,
  validateProviderConfig,
} from '../utils/config'
import { useOidcLogger } from '../utils/logger'
import { convertObjectToSnakeCase, oidcErrorHandler } from '../utils/oidc'
import type { OidcProviderConfig } from '../utils/provider'
import { isOidcProvider } from '../utils/provider-config'
import { sanitizeCallbackRedirectUrl } from '../utils/redirect'
import { canChangeLoginTransaction } from '../utils/request'
import {
  generatePkceCodeChallenge,
  generatePkceVerifier,
  generateRandomUrlSafeString,
} from '../utils/security'
import { useAuthSession } from '../utils/session'
import { snakeCase } from '../utils/string'

const providerPresetsByName = { ...providerPresets }

const reservedAuthParameters = new Set([
  'client_id',
  'redirect_uri',
  'response_type',
  'response_mode',
  'state',
  'scope',
  'code_challenge',
  'code_challenge_method',
  'nonce',
])

// `none` (OIDC Core) and `create` (OIDC Prompt Create) must stand alone
const clientPromptPattern =
  /^(?:none|create|(?:login|consent|select_account)(?: (?:login|consent|select_account))*)$/u

function loginEventHandler() {
  const logger = useOidcLogger()
  return eventHandler(async (event: H3Event) => {
    const provider = event.path.split('/')[2]
    if (!canChangeLoginTransaction(event)) {
      logger.warn(`[${provider}] Ignoring login request from another site that is not a navigation`)
      throw createError({ statusCode: 403, message: 'Forbidden' })
    }
    const runtimeConfig = useRuntimeConfig()
    let config: OidcProviderConfig
    try {
      if (!isOidcProvider(provider)) {
        throw new Error('Unknown OIDC provider')
      }
      config = await resolveEffectiveProviderConfig(
        runtimeConfig.oidc.providers[provider],
        providerPresetsByName[provider],
      )
    } catch (error) {
      await oidcErrorHandler(event, `[${provider}] Provider discovery failed: ${String(error)}`)
      return
    }
    const validationResult = validateProviderConfig(config, 'login')

    if (!validationResult.valid) {
      logger.error(
        `[${provider}] Invalid configuration: ${formatProviderConfigValidation(validationResult)}`,
      )
      await oidcErrorHandler(event, 'Invalid configuration')
      return
    }

    // Initialize auth session
    const session = await useAuthSession(
      event,
      config.sessionConfiguration?.maxAuthSessionAge ??
        // oxlint-disable-next-line typescript/no-unnecessary-condition -- Runtime overrides and request adapters can omit the session object; preserve the existing auth-session fallback.
        runtimeConfig.oidc.session?.maxAuthSessionAge,
    )
    await session.clear()
    await session.update({
      state: generateRandomUrlSafeString(),
      codeVerifier: generatePkceVerifier(),
      referer: getRequestHeader(event, 'referer'),
      nonce: undefined,
    })

    // Get client side query parameters
    const clientQueryParams = getQuery(event)
    const additionalClientAuthParameters: QueryObject = {}
    for (const param of config.allowedClientAuthParameters ?? []) {
      const name = snakeCase(param)
      const value = clientQueryParams[param]
      if (name === 'prompt') {
        if (typeof value === 'string' && clientPromptPattern.test(value)) {
          additionalClientAuthParameters[param] = value
        }
        continue
      }
      if (reservedAuthParameters.has(name)) {
        continue
      }
      const hasValue = Boolean(value)
      if (hasValue) {
        additionalClientAuthParameters[param] = value
      }
    }

    const callbackRedirectUrlParam: unknown = Array.isArray(
      clientQueryParams['callbackRedirectUrl'],
    )
      ? clientQueryParams['callbackRedirectUrl'][0]
      : clientQueryParams['callbackRedirectUrl']
    const callbackRedirectUrl = sanitizeCallbackRedirectUrl(callbackRedirectUrlParam)
    if (callbackRedirectUrl !== undefined && callbackRedirectUrl !== '') {
      await session.update({ callbackRedirectUrl })
    }

    let clientRedirectUri: string | undefined
    const redirectUri = clientQueryParams['redirectUri']
    if (typeof redirectUri === 'string' && redirectUri !== '') {
      clientRedirectUri =
        config.allowedCallbackRedirectUrls?.some((callbackUrl) => {
          if (!redirectUri.startsWith(callbackUrl)) {
            return false
          }
          if (callbackUrl.endsWith('/')) {
            return true
          }
          const nextChar = redirectUri[callbackUrl.length]
          return nextChar === undefined || nextChar === '/' || nextChar === '?' || nextChar === '#'
        }) === true
          ? redirectUri
          : undefined
      if (clientRedirectUri !== undefined && clientRedirectUri !== '') {
        await session.update({ redirect: clientRedirectUri })
      }
    }

    const query: AuthorizationRequest | PkceAuthorizationRequest = {
      client_id: config.clientId,
      response_type: config.responseType,
      ...(Boolean(config.state) && { state: session.data.state }),
      ...(config.scope && { scope: config.scope.join(' ') }),
      ...(config.responseMode !== '' && { response_mode: config.responseMode }),
      ...(config.redirectUri !== '' && {
        redirect_uri:
          clientRedirectUri !== undefined && clientRedirectUri !== ''
            ? clientRedirectUri
            : config.redirectUri,
      }),
      ...(config.prompt && { prompt: config.prompt.join(' ') }),
      ...(Boolean(config.pkce) && {
        code_challenge: await generatePkceCodeChallenge(session.data.codeVerifier),
        code_challenge_method: 'S256',
      }),
      ...(config.additionalAuthParameters &&
        convertObjectToSnakeCase(config.additionalAuthParameters)),
      ...convertObjectToSnakeCase(additionalClientAuthParameters),
    }

    // Handling hybrid flows or mitigate replay attacks with nonce
    if (config.responseType.includes('token') || config.nonce === true) {
      const nonce = generateRandomUrlSafeString()
      await session.update({ nonce })
      query.response_mode = 'form_post'
      query.nonce = nonce
      if (query.scope?.includes('openid') !== true) {
        query.scope = `openid ${query.scope}`
      }
    }

    await sendRedirect(
      event,
      config.encodeRedirectUri === true
        ? withQuery(config.authorizationUrl, query).replace(
            query.redirect_uri ?? '',
            encodeURI(query.redirect_uri ?? ''),
          )
        : withQuery(config.authorizationUrl, query),
      302,
    )
  })
}

export default loginEventHandler()
