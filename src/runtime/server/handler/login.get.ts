export default oidc.loginEventHandler({
  async onSuccess(event) {
    return sendRedirect(event, '/')
  }
})
