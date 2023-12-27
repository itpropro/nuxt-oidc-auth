export default logoutEventHandler({
  async onSuccess(event) {
    return sendRedirect(event, '/')
  }
})
