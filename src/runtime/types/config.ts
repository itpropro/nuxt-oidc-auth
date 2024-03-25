import type { H3Event, H3Error } from 'h3'
import type { UserSession } from './session'

export interface OAuthConfig<TUser = UserSession> {
  onSuccess: (
    event: H3Event,
    result: { user: TUser }
  ) => Promise<void> | void;
  onError?: (event: H3Event, error: H3Error) => Promise<void> | void;
}
