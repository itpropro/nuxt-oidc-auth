import type { H3Event } from 'h3'
import { deleteCookie, sendRedirect } from 'h3'

import { useOidcLogger } from './logger'
import { withAppBase } from './redirect'

export { useOidcLogger } from './logger'
export {
  convertObjectToSnakeCase,
  convertTokenRequestToType,
  formatTokenRequestError,
  generateFormDataRequest,
  generateFormUrlEncodedRequest,
  refreshAccessToken,
} from './token-refresh'

/**
 * Fail a login attempt: discards only its auth transaction and keeps an established user session, so
 * a failed or forged callback cannot sign the user out or revoke the single sign-out group.
 */
export async function oidcErrorHandler(
  event: H3Event,
  errorText: string,
  errorCode = 500,
): Promise<void> {
  const logger = useOidcLogger()
  deleteCookie(event, 'oidc')
  logger.error(errorText, '- Code:', errorCode)
  await sendRedirect(event, withAppBase('/'), 302)
}
