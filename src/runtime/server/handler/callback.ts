import { sendRedirect } from 'h3'
import { callbackEventHandler } from '../lib/oidc'
import { setUserSession } from '../utils/session'
import type { UserSession } from '../../types/session'

export default callbackEventHandler({
  async onSuccess(event, { user, callbackRedirectUrl }) {
    await setUserSession(event, user as UserSession)
    return sendRedirect(event, callbackRedirectUrl || '/' as string)
  },
})
