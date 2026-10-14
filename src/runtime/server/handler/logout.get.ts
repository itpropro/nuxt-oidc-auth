import type { EventHandler, EventHandlerRequest, H3Event } from 'h3'
import { eventHandler, getQuery, getRequestURL, sendRedirect } from 'h3'
import type { QueryValue } from 'ufo'
import { withQuery } from 'ufo'

import { useRuntimeConfig } from '#imports'

import * as providerPresets from '../../providers'
import type { OAuthConfig, UserSession } from '../../types'
import {
  formatProviderConfigValidation,
  resolveEffectiveProviderConfig,
  validateProviderConfig,
} from '../utils/config'
import { useOidcLogger } from '../utils/logger'
import { convertObjectToSnakeCase } from '../utils/oidc'
import type { OidcProviderConfig } from '../utils/provider'
import { isOidcProvider } from '../utils/provider-config'
import { withAppBase } from '../utils/redirect'
import { clearUserSession, getPersistedIdToken, getUserSession } from '../utils/session'

const providerPresetsByName = { ...providerPresets }

export function logoutEventHandler({
  onSuccess,
}: OAuthConfig<UserSession>): EventHandler<EventHandlerRequest, Promise<void>> {
  const logger = useOidcLogger()
  return eventHandler(async (event: H3Event) => {
    const provider = event.path.split('/')[2]
    if (provider === 'dev') {
      await clearUserSession(event)
      await onSuccess(event, { user: null })
      return
    }
    let config: OidcProviderConfig
    try {
      if (!isOidcProvider(provider)) {
        throw new Error('Unknown OIDC provider')
      }
      config = await resolveEffectiveProviderConfig(
        useRuntimeConfig().oidc.providers[provider],
        providerPresetsByName[provider],
      )
    } catch (error) {
      logger.error(
        `[${provider}] Skipping provider logout because provider discovery failed: ${String(error)}`,
      )
      await clearUserSession(event)
      await onSuccess(event, { user: null })
      return
    }
    const validationResult = validateProviderConfig(config, 'logout')

    if (!validationResult.valid) {
      logger.error(
        `[${provider}] Skipping provider logout because configuration is invalid: ${formatProviderConfigValidation(validationResult)}`,
      )
      await clearUserSession(event)
      await onSuccess(event, { user: null })
      return
    }

    if (config.logoutUrl !== undefined && config.logoutUrl !== '') {
      const logoutParams = getQuery(event)
      let logoutRedirectUri: QueryValue = config.logoutRedirectUri
      const redirectParameter = logoutParams['logoutRedirectUri']
      const legacyRedirectParameter = logoutParams['logout_redirect_uri']
      const hasRedirectParameter = Boolean(redirectParameter)
      const hasLegacyRedirectParameter = Boolean(legacyRedirectParameter)
      if (hasRedirectParameter) {
        logoutRedirectUri = redirectParameter
      } else if (hasLegacyRedirectParameter) {
        logoutRedirectUri = legacyRedirectParameter
      }

      // Set logout_hint and id_token_hint dynamic parameters if specified. According to https://openid.net/specs/openid-connect-rpinitiated-1_0.html#RPLogout
      const additionalLogoutParameters: Record<string, string> = config.additionalLogoutParameters
        ? { ...config.additionalLogoutParameters }
        : {}
      if (config.additionalLogoutParameters) {
        let userSession: UserSession
        try {
          userSession = await getUserSession(event)
        } catch {
          await clearUserSession(event)
          await onSuccess(event, { user: null })
          return
        }
        if (Object.hasOwn(config.additionalLogoutParameters, 'idTokenHint')) {
          const exposedIdToken = userSession.idToken
          const idTokenHint =
            exposedIdToken !== undefined && exposedIdToken !== ''
              ? exposedIdToken
              : await getPersistedIdToken(event)
          if (idTokenHint !== undefined && idTokenHint !== '') {
            additionalLogoutParameters['idTokenHint'] = idTokenHint
          }
        }
        const logoutHint: unknown = userSession.claims?.['login_hint']
        const hasLogoutHint = Boolean(logoutHint)
        if (Object.hasOwn(config.additionalLogoutParameters, 'logoutHint') && hasLogoutHint) {
          // SAFETY: The existing session claim contract carries the provider's logout hint through unchanged; withQuery performs its serialization.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Preserve provider claim values accepted by the existing logout flow.
          additionalLogoutParameters['logoutHint'] = logoutHint as string
        }
      }
      const location = withQuery(config.logoutUrl, {
        ...(config.logoutRedirectParameterName !== undefined &&
          config.logoutRedirectParameterName !== '' &&
          Boolean(logoutRedirectUri) && {
            [config.logoutRedirectParameterName]: logoutRedirectUri,
          }),
        ...(config.additionalLogoutParameters &&
          convertObjectToSnakeCase(additionalLogoutParameters)),
      })

      // Clear session
      await clearUserSession(event)
      await sendRedirect(event, location, 302)
      return
    }
    // Clear session
    await clearUserSession(event)
    await onSuccess(event, {
      user: null,
    })
  })
}

export default logoutEventHandler({
  async onSuccess(event) {
    const origin = getRequestURL(event).origin
    const appRoot = withAppBase('/')
    await sendRedirect(event, appRoot === '/' ? origin : `${origin}${appRoot}`, 302)
  },
})
