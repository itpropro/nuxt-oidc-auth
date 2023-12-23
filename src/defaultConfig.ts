import type { ModuleOptions, ProviderConfigs } from '#oidc-auth'

export const defaultConfig: ModuleOptions = {
  enabled: true,
  session: {
    name: 'auth-session',
    automaticRefresh: false,
    cookie: {
      sameSite: 'lax',
      maxAge: 60 * 15
    },
  },
  providers: {} as ProviderConfigs,
  middleware: {
    globalMiddlewareEnabled: false,
    customLoginPage: false,
  },
}
