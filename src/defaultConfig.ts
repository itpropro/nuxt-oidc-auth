import type { ModuleOptions } from '#oidc-auth'

export const defaultConfig: ModuleOptions = {
  enabled: true,
  session: {
    name: 'auth-session',
    password: '',
    automaticRefresh: false,
    cookie: {
      sameSite: 'lax',
      maxAge: 60 * 15
    }
  },
  providers: {} as any,
}
