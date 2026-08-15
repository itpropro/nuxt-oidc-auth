import type { OAuthConfig, ProviderKeysWithDev, UserSession } from '../../types'
import type { H3Event } from 'h3'
import type { OidcProviderConfig } from '../utils/provider'
import { useRuntimeConfig } from '#imports'
import { eventHandler, getQuery, getRequestURL, sendRedirect } from 'h3'
import { withQuery } from 'ufo'
import * as providerPresets from '../../providers'
import {
  formatProviderConfigValidation,
  resolveProviderConfig,
  validateProviderConfig,
} from '../utils/config'
import { convertObjectToSnakeCase, useOidcLogger } from '../utils/oidc'
import { withAppBase } from '../utils/redirect'
import { clearUserSession, getUserSession } from '../utils/session'

export function logoutEventHandler({ onSuccess }: OAuthConfig<UserSession>) {
  const logger = useOidcLogger()
  return eventHandler(async (event: H3Event) => {
    // TODO: Is this the best way to get the current provider?
    const provider = event.path.split('/')[2] as ProviderKeysWithDev
    if (provider === 'dev') {
      await clearUserSession(event)
      return onSuccess(event, { user: null })
    }
    const config = resolveProviderConfig(
      useRuntimeConfig().oidc.providers[provider] as OidcProviderConfig,
      providerPresets[provider as keyof typeof providerPresets],
    )
    const validationResult = validateProviderConfig(config, 'logout')

    if (!validationResult.valid) {
      logger.error(
        `[${provider}] Skipping provider logout because configuration is invalid: ${formatProviderConfigValidation(validationResult)}`,
      )
      await clearUserSession(event)
      return onSuccess(event, { user: null })
    }

    if (config.logoutUrl) {
      const logoutParams = getQuery(event)
      const logoutRedirectUri =
        logoutParams.logoutRedirectUri ||
        logoutParams.logout_redirect_uri ||
        config.logoutRedirectUri

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
          return onSuccess(event, { user: null })
        }
        Object.keys(config.additionalLogoutParameters).forEach((key) => {
          if (key === 'idTokenHint' && userSession.idToken)
            additionalLogoutParameters[key] = userSession.idToken
          if (key === 'logoutHint' && userSession.claims?.login_hint)
            additionalLogoutParameters[key] = userSession.claims.login_hint as string
        })
      }
      const location = withQuery(config.logoutUrl, {
        ...(config.logoutRedirectParameterName &&
          logoutRedirectUri && { [config.logoutRedirectParameterName]: logoutRedirectUri }),
        ...(config.additionalLogoutParameters &&
          convertObjectToSnakeCase(additionalLogoutParameters)),
      })

      // Clear session
      await clearUserSession(event)
      return sendRedirect(event, location, 302)
    }
    // Clear session
    await clearUserSession(event)
    return onSuccess(event, {
      user: null,
    })
  })
}

export default logoutEventHandler({
  async onSuccess(event) {
    const origin = getRequestURL(event).origin
    const appRoot = withAppBase('/')
    return sendRedirect(event, appRoot === '/' ? origin : `${origin}${appRoot}`, 302)
  },
})
