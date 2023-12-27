export default loginEventHandler({
  async onSuccess(event) {
    return sendRedirect(event, '/')
  }
})
