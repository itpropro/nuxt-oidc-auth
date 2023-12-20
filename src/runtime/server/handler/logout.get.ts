export default oidc.logoutEventHandler({
  async onSuccess(event) {
    return sendRedirect(event, '/')
  }
})
