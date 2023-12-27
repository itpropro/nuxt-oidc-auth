import { logoutEventHandler } from '../lib/oidc'

export default logoutEventHandler({
  async onSuccess(event) {
    return sendRedirect(event, '/')
  }
})
