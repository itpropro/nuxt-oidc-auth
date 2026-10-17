import { format } from 'node:util'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { provideDefaultSecrets } from '../../../src/runtime/server/utils/default-secrets'
import { findLeakedSecretFragment } from '../../setup/test-helpers'

const SECRET_NAMES = [
  'NUXT_OIDC_SESSION_SECRET',
  'NUXT_OIDC_TOKEN_KEY',
  'NUXT_OIDC_AUTH_SESSION_SECRET',
] as const

function captureOutput(): () => string {
  const output: string[] = []
  for (const method of ['debug', 'error', 'info', 'log', 'warn'] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      output.push(format(...args))
    })
  }
  for (const stream of [process.stdout, process.stderr]) {
    vi.spyOn(stream, 'write').mockImplementation((chunk: string | Uint8Array) => {
      output.push(String(chunk))
      return true
    })
  }
  return () => output.join('\n')
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('default secrets', () => {
  it.each(['development', 'production', 'test'])(
    'generates missing secrets and logs only a five-character prefix with NODE_ENV=%s',
    async (nodeEnv) => {
      vi.stubEnv('NODE_ENV', nodeEnv)
      for (const name of SECRET_NAMES) {
        vi.stubEnv(name, undefined)
      }
      const output = captureOutput()

      await expect(provideDefaultSecrets()).resolves.toStrictEqual([...SECRET_NAMES])

      const log = output()
      for (const name of SECRET_NAMES) {
        const secret = process.env[name] ?? ''
        expect(secret.length).toBeGreaterThanOrEqual(44)
        expect(log).toContain(`[nuxt-oidc-auth]: ${name}=${secret.slice(0, 5)}[redacted]`)
        expect(findLeakedSecretFragment(log, secret)).toBeUndefined()
      }
    },
  )
})
