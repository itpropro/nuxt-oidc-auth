export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session) => {
    // Extend User Session
    // Or throw createError({ ... }) if session is invalid
    // session.extended = {
    //   fromHooks: true
    // }
    console.log('Injecting "country" claim as test')
    if (!(Object.keys(session).length === 0)) {
      const claimToAdd = { country: 'Germany' }
      session.claims = { ...session.claims, ...claimToAdd }
    }
  })

  sessionHooks.hook('clear', async () => {
    // Log that user logged out
    console.log('User logged out')
  })
})
