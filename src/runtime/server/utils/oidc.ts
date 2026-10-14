import type { H3Event } from 'h3'
import { sendRedirect } from 'h3'

import { useOidcLogger } from './logger'
import { withAppBase } from './redirect'
import { clearUserSession } from './session'

export { useOidcLogger } from './logger'
export {
  convertObjectToSnakeCase,
  convertTokenRequestToType,
  formatTokenRequestError,
  generateFormDataRequest,
  generateFormUrlEncodedRequest,
  refreshAccessToken,
} from './token-refresh'

export async function oidcErrorHandler(
  event: H3Event,
  errorText: string,
  errorCode = 500,
): Promise<void> {
  const logger = useOidcLogger()
  await clearUserSession(event, true)
  logger.error(errorText, '- Code:', errorCode)
  await sendRedirect(event, withAppBase('/'), 302)
}
