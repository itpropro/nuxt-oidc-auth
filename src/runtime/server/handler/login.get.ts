import { loginEventHandler } from '../lib/oidc'
import { sendRedirect } from 'h3'

export default loginEventHandler({
  async onSuccess(event) {
    return sendRedirect(event, '/')
  }
})
