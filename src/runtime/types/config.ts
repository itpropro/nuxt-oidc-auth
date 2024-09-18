import type { H3Event } from 'h3'

export interface OAuthConfig<UserSession> {
  onSuccess: (
    event: H3Event,
    result: { user: UserSession | null, callbackRedirectUrl?: string }
  ) => Promise<void> | void
}
