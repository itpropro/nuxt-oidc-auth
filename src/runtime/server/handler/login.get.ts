import { loginEventHandler } from '../lib/oidc'

export default loginEventHandler({
  async onSuccess(event) {
    return sendRedirect(event, '/')
  }
})
