export default defineEventHandler((event) => {
  const provider = useRuntimeConfig(event).oidc.providers.oidc
  if (!provider) throw createError({ statusCode: 500, message: 'OIDC provider missing' })

  return {
    additionalAuthParameters: provider.additionalAuthParameters,
    allowedCallbackRedirectUrls: provider.allowedCallbackRedirectUrls,
    callbackRedirectUrl: provider.callbackRedirectUrl,
    exposeAccessToken: provider.exposeAccessToken,
    scope: provider.scope,
    sessionConfiguration: {
      automaticRefresh: provider.sessionConfiguration?.automaticRefresh,
      expirationThreshold: provider.sessionConfiguration?.expirationThreshold,
    },
  }
})
