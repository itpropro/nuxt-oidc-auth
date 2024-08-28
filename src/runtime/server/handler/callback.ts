import { sendRedirect } from 'h3'
import { callbackEventHandler } from '../lib/oidc'
import { setUserSession } from '../utils/session'

export default callbackEventHandler({
  async onSuccess(event, { user }) {
    await setUserSession(event, user)
    return sendRedirect(event, '/')
  },
})
