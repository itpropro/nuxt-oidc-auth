import { devEventHandler } from '../lib/oidc'
import { sendRedirect } from 'h3'

export default devEventHandler({
  async onSuccess(event) {
    return sendRedirect(event, '/')
  }
})
