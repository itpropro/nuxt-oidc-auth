import type { UserSession } from '../../types'
import { sendRedirect } from 'h3'
import { devEventHandler } from '../lib/oidc'
import { setUserSession } from '../utils/session'

export default devEventHandler({
  async onSuccess(event, { user }) {
    await setUserSession(event, user as UserSession)
    return sendRedirect(event, '/')
  },
})
