import type { OAuthConfig, ProviderKeys, UserSession } from '#oidc-auth'
import type { H3Event } from 'h3'
import type { OidcProviderConfig } from '../utils/provider'
import { useRuntimeConfig } from '#imports'
import { eventHandler, getQuery, getRequestURL, sendRedirect } from 'h3'
import { withQuery } from 'ufo'
import * as providerPresets from '../../providers'
import { configMerger, convertObjectToSnakeCase } from '../utils/oidc'
import { clearUserSession, getUserSession } from '../utils/session'

export function logoutEventHandler({ onSuccess }: OAuthConfig<UserSession>) {
  return eventHandler(async (event: H3Event) => {
    // TODO: Is this the best way to get the current provider?
    const provider = event.path.split('/')[2] as ProviderKeys
    const config = configMerger(useRuntimeConfig().oidc.providers[provider] as OidcProviderConfig, providerPresets[provider])

    if (config.logoutUrl) {
      const logoutParams = getQuery(event)
      const logoutRedirectUri = logoutParams.logoutRedirectUri || config.logoutRedirectUri

      // Set logout_hint and id_token_hint dynamic parameters if specified. According to https://openid.net/specs/openid-connect-rpinitiated-1_0.html#RPLogout
      const additionalLogoutParameters: Record<string, string> = config.additionalLogoutParameters ? { ...config.additionalLogoutParameters } : {}
      if (config.additionalLogoutParameters) {
        let userSession: UserSession
        try {
          userSession = await getUserSession(event)
        }
        catch {
          return sendRedirect(event, `${getRequestURL(event).protocol}//${getRequestURL(event).host}`, 302)
        }
        Object.keys(config.additionalLogoutParameters).forEach((key) => {
          if (key === 'idTokenHint' && userSession.idToken)
            additionalLogoutParameters[key] = userSession.idToken
          if (key === 'logoutHint' && userSession.claims?.login_hint)
            additionalLogoutParameters[key] = userSession.claims.login_hint as string
        })
      }
      const location = withQuery(config.logoutUrl, {
        ...(config.logoutRedirectParameterName && logoutRedirectUri) && { [config.logoutRedirectParameterName]: logoutRedirectUri },
        ...config.additionalLogoutParameters && convertObjectToSnakeCase(additionalLogoutParameters),
      })

      // Clear session
      await clearUserSession(event)
      return sendRedirect(
        event,
        location,
        302,
      )
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
    return sendRedirect(event, `${getRequestURL(event).protocol}//${getRequestURL(event).host}`, 302)
  },
})
