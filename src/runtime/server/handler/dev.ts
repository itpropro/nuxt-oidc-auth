import { sendRedirect } from 'h3'
import { devEventHandler } from '../lib/oidc'
import { setUserSession } from '../utils/session'

export default devEventHandler({
  async onSuccess(event, { user }) {
    await setUserSession(event, user)
    return sendRedirect(event, '/')
  },
})
