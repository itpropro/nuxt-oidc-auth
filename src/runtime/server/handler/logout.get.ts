import { logoutEventHandler } from '../lib/oidc'
import { sendRedirect } from 'h3'

export default logoutEventHandler({
  async onSuccess(event) {
    return sendRedirect(event, '/', 302)
  }
})
