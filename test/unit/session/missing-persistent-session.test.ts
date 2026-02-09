import { describe, expect, it } from 'vitest'
import { resolveMissingPersistentSessionMode } from '../../../src/runtime/server/utils/session-options'

describe('missing persistent session mode', () => {
  it('defaults to clear when no mode is configured', () => {
    const mode = resolveMissingPersistentSessionMode(undefined, { singleSignOut: false })

    expect(mode).toBe('clear')
  })

  it('uses warn mode when configured', () => {
    const mode = resolveMissingPersistentSessionMode({ missingPersistentSession: 'warn' }, { singleSignOut: false })

    expect(mode).toBe('warn')
  })

  it('uses silent mode when configured', () => {
    const mode = resolveMissingPersistentSessionMode({ missingPersistentSession: 'silent' }, { singleSignOut: false })

    expect(mode).toBe('silent')
  })

  it('forces clear mode when single sign out is enabled', () => {
    const mode = resolveMissingPersistentSessionMode({ missingPersistentSession: 'silent' }, { singleSignOut: true })

    expect(mode).toBe('clear')
  })

  it('falls back to clear for invalid runtime values', () => {
    const mode = resolveMissingPersistentSessionMode({ missingPersistentSession: 'invalid' as 'clear' }, { singleSignOut: false })

    expect(mode).toBe('clear')
  })
})
