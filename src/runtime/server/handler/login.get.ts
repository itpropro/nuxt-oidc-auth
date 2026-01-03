import type { H3Event } from 'h3'
import type { AuthorizationRequest, PkceAuthorizationRequest, ProviderKeys } from '../../types'
import type { OidcProviderConfig } from '../utils/provider'
import { useRuntimeConfig } from '#imports'
import { eventHandler, getQuery, getRequestHeader, sendRedirect } from 'h3'
import { withQuery } from 'ufo'
import * as providerPresets from '../../providers'
import { validateConfig } from '../utils/config'
import { configMerger, convertObjectToSnakeCase, oidcErrorHandler, useOidcLogger } from '../utils/oidc'
import { generatePkceCodeChallenge, generatePkceVerifier, generateRandomUrlSafeString } from '../utils/security'
import { useAuthSession } from '../utils/session'

function loginEventHandler() {
  const logger = useOidcLogger()
  return eventHandler(async (event: H3Event) => {
    const provider = event.path.split('/')[2] as ProviderKeys
    const config = configMerger(useRuntimeConfig().oidc.providers[provider] as OidcProviderConfig, providerPresets[provider])
    const validationResult = validateConfig(config, config.requiredProperties)

    if (!validationResult.valid) {
      logger.error(`[${provider}] Missing configuration properties:`, validationResult.missingProperties?.join(', '))
      oidcErrorHandler(event, 'Invalid configuration')
    }

    // Initialize auth session
    const session = await useAuthSession(event, config.sessionConfiguration?.maxAuthSessionAge)
    await session.clear()
    // Get client side query parameters
    const additionalClientAuthParameters: Record<string, string> = {}
    if (config.allowedClientAuthParameters?.length) {
      const clientQueryParams = getQuery(event)
      config.allowedClientAuthParameters.forEach((param) => {
        if (clientQueryParams[param]) {
          additionalClientAuthParameters[param] = clientQueryParams[param] as string
        }
      })
    }

    const state = {
      token: generateRandomUrlSafeString(),
      additionalClientAuthParameters: additionalClientAuthParameters
    }

    await session.update({
      state,
      codeVerifier: generatePkceVerifier(),
      referer: getRequestHeader(event, 'referer'),
      nonce: undefined,
    })

    let clientRedirectUri: string | undefined
    if (config.allowedCallbackRedirectUrls?.length) {
      const clientQueryParams = getQuery(event)
      if (clientQueryParams.redirectUri) {
        clientRedirectUri = config.allowedCallbackRedirectUrls.some(callbackUrl => (clientQueryParams.redirectUri as string).startsWith(callbackUrl)) ? clientQueryParams.redirectUri as string : undefined
      }
      if (clientRedirectUri) {
        await session.update({ redirect: clientRedirectUri })
      }
    }

    const query: AuthorizationRequest | PkceAuthorizationRequest = {
      client_id: config.clientId,
      response_type: config.responseType,
      ...config.state && { state: session.data.state },
      ...config.scope && { scope: config.scope.join(' ') },
      ...config.responseMode && { response_mode: config.responseMode },
      ...config.redirectUri && { redirect_uri: clientRedirectUri || config.redirectUri },
      ...config.prompt && { prompt: config.prompt.join(' ') },
      ...config.pkce && { code_challenge: await generatePkceCodeChallenge(session.data.codeVerifier), code_challenge_method: 'S256' },
      ...config.additionalAuthParameters && convertObjectToSnakeCase(config.additionalAuthParameters),
      ...additionalClientAuthParameters && convertObjectToSnakeCase(additionalClientAuthParameters),
    }

    // Handling hybrid flows or mitigate replay attacks with nonce
    if (config.responseType.includes('token') || config.nonce) {
      const nonce = generateRandomUrlSafeString()
      await session.update({ nonce })
      query.response_mode = 'form_post'
      query.nonce = nonce
      if (!query.scope?.includes('openid'))
        query.scope = `openid ${query.scope}`
    }

    return sendRedirect(
      event,
      config.encodeRedirectUri ? withQuery(config.authorizationUrl, query).replace(query.redirect_uri!, encodeURI(query.redirect_uri!)) : withQuery(config.authorizationUrl, query),
      302,
    )
  })
}

export default loginEventHandler()
