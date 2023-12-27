import { callbackEventHandler } from '../lib/oidc'
import { setUserSession } from '../utils/session'
import { sendRedirect } from 'h3'

export default callbackEventHandler({
  async onSuccess(event, { user }) {
    await setUserSession(event, user)
    return sendRedirect(event, '/')
  }
})
