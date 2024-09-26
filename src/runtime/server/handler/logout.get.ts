import { getRequestURL, sendRedirect } from 'h3'
import { logoutEventHandler } from '../lib/oidc'

export default logoutEventHandler({
  async onSuccess(event) {
    return sendRedirect(event, `${getRequestURL(event).protocol}//${getRequestURL(event).host}`, 302)
  },
})
