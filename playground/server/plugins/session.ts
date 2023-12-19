export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session) => {
    // Extend User Session
    // Or throw createError({ ... }) if session is invalid
    // session.extended = {
    //   fromHooks: true
    // }
    if (!(Object.keys(session).length === 0)) {
      const claimToAdd = { country: 'Germany' }
      session.claims = { ...session.claims, ...claimToAdd }
    }
    console.log('fetch hook finished')
  })

  sessionHooks.hook('clear', async (session) => {
    // Log that user logged out
    console.log('User logged out')
  })
})
