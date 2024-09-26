export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session) => {
    // Extend User Session
    // Or throw createError({ ... }) if session is invalid
    // session.extended = {
    //   fromHooks: true
    // }
    // eslint-disable-next-line no-console
    console.log('Injecting "status" claim as test on fetch')
    if (!(Object.keys(session).length === 0)) {
      const claimToAdd = { status: 'Fetch' }
      session.claims = { ...session.claims, ...claimToAdd }
    }
  })

  sessionHooks.hook('refresh', async (session) => {
    // eslint-disable-next-line no-console
    console.log('Injecting "status" claim as test on refresh')
    if (!(Object.keys(session).length === 0)) {
      const claimToAdd = { status: 'Refresh' }
      session.claims = { ...session.claims, ...claimToAdd }
    }
  })

  sessionHooks.hook('clear', async () => {
    // Log that user logged out
    // eslint-disable-next-line no-console
    console.log('User logged out')
  })
})
