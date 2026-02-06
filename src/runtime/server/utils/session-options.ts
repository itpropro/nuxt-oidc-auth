import type { ProviderSessionConfig, UserSession } from '../../types'

export type MissingPersistentSessionMode = 'clear' | 'warn' | 'silent'

export function resolveMissingPersistentSessionMode(
  providerSessionConfig: ProviderSessionConfig | undefined,
  userSession: Pick<UserSession, 'singleSignOut'>,
): MissingPersistentSessionMode {
  if (userSession.singleSignOut) {
    return 'clear'
  }

  return providerSessionConfig?.missingPersistentSession || 'clear'
}
