import { sendRedirect } from 'h3'
import { logoutEventHandler } from '../lib/oidc'

export default logoutEventHandler({
  async onSuccess(event) {
    return sendRedirect(event, '/', 302)
  },
})
