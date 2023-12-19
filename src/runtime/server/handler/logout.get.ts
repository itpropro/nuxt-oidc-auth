export default oidc.logoutEventHandler({
  async onSuccess(event) {
    await clearUserSession(event)
    return sendRedirect(event, '/')
  }
})
