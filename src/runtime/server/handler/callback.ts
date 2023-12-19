export default oidc.callbackEventHandler({
  async onSuccess(event, { user }) {
    await setUserSession(event, user)
    return sendRedirect(event, '/')
  }
})
