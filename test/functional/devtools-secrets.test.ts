import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

import { buildNuxt, loadNuxt } from '@nuxt/kit'
import { createBirpc } from 'birpc'
import { createEvent, unsealSession } from 'h3'
import { parse, stringify } from 'structured-clone-es'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { findLeakedSecretFragment } from '../setup/test-helpers'

type Secrets = Record<'tokenKey' | 'sessionSecret' | 'authSessionSecret', string>

interface DevtoolsServerFunctions {
  verifyAuthToken: (token: string) => Promise<boolean>
  'nuxt-oidc-auth-rpc:getNuxtOidcAuthSecrets': (token: string) => Promise<Secrets>
}

interface Server {
  url: string
  home: string
  output: () => string
  stop: () => Promise<void>
}

const SECRET_NAMES = [
  'NUXT_OIDC_SESSION_SECRET',
  'NUXT_OIDC_TOKEN_KEY',
  'NUXT_OIDC_AUTH_SESSION_SECRET',
] as const
const DEVTOOLS_RPC_EVENT = 'nuxt:devtools:rpc'
// Generated values are base64 or base64url; a log line may show five of their characters only.
const PREFIXED_SECRET_LOG_RE =
  /NUXT_OIDC_(?:SESSION_SECRET|TOKEN_KEY|AUTH_SESSION_SECRET)=[\w+/-]{5}\[redacted\]/gu
const SECRET_LOG_RE = /NUXT_OIDC_(?:SESSION_SECRET|TOKEN_KEY|AUTH_SESSION_SECRET)=/gu
const SERVER_TIMEOUT = 120_000
const STOP_TIMEOUT = 10_000
const DEV_MODE_REQUIRED_ERROR =
  '[nuxt-oidc-auth] Secrets are only available on the dev server with dev mode enabled.'
const DEVTOOLS_HINT = 'Generated secrets are available in Nuxt DevTools'

const fixtureDir = fileURLToPath(new URL('../fixtures/devModeApp', import.meta.url))
const nuxiBin = fileURLToPath(new URL('../../node_modules/@nuxt/cli/bin/nuxi.mjs', import.meta.url))

async function findFreePort(): Promise<number> {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  server.close()
  if (address === null || typeof address === 'string') {
    throw new Error('Expected a TCP server address')
  }
  return address.port
}

// Spawned servers must not inherit the test runner's secrets or test-mode flags, which disable DevTools.
function serverEnvironment(environment: Record<string, string>): NodeJS.ProcessEnv {
  const excluded = new Set<string>(['NODE_ENV', 'TEST', ...SECRET_NAMES])
  return {
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        ([name]) => !excluded.has(name) && !name.startsWith('VITEST'),
      ),
    ),
    ...environment,
  }
}

function signalProcessGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal)
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) {
      throw error
    }
  }
}

async function startServer(
  args: string[],
  environment: Record<string, string>,
  readyOutput: string,
): Promise<Server> {
  const home = await mkdtemp(join(tmpdir(), 'nuxt-oidc-auth-devtools-home-'))
  const port = await findFreePort()
  const chunks: string[] = []
  const child: ChildProcess = spawn(process.execPath, args, {
    detached: true,
    env: serverEnvironment({ ...environment, HOME: home, HOST: '127.0.0.1', PORT: String(port) }),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout?.on('data', (chunk: Buffer) => {
    chunks.push(chunk.toString())
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    chunks.push(chunk.toString())
  })
  const output = () => chunks.join('')

  const stop = async () => {
    try {
      const { pid } = child
      if (pid !== undefined) {
        if (child.exitCode === null && child.signalCode === null) {
          const exited = once(child, 'exit')
          // Stop the whole process group: nuxi dev forks the Nuxt process.
          signalProcessGroup(pid, 'SIGTERM')
          const stopped = await Promise.race([
            exited.then(() => true),
            delay(STOP_TIMEOUT).then(() => false),
          ])
          if (!stopped) {
            signalProcessGroup(pid, 'SIGKILL')
            await exited
          }
        }
        // Remove children that outlived the group leader.
        signalProcessGroup(pid, 'SIGKILL')
      }
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  }

  try {
    await vi.waitFor(
      () => {
        if (child.exitCode !== null) {
          throw new Error(`Server exited early:\n${output()}`)
        }
        expect(output()).toContain(readyOutput)
      },
      { timeout: SERVER_TIMEOUT, interval: 200 },
    )
  } catch (error) {
    await stop()
    throw error
  }
  return { url: `http://127.0.0.1:${port}`, home, output, stop }
}

async function startDevServer(environment: Record<string, string>): Promise<Server> {
  return await startServer(
    [nuxiBin, 'dev', fixtureDir],
    { NODE_ENV: 'development', NUXT_OIDC_TEST_DEVTOOLS: 'true', ...environment },
    'Nitro server built',
  )
}

function isDevtoolsRpcMessage(value: unknown): value is { data: unknown } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === 'custom' &&
    'event' in value &&
    value.event === DEVTOOLS_RPC_EVENT &&
    'data' in value
  )
}

// Speaks the Nuxt DevTools RPC protocol over the dev server's Vite websocket, like the DevTools UI.
async function connectDevtools(url: string) {
  const socket = new WebSocket(`${url.replace('http', 'ws')}/_nuxt/`, 'vite-hmr')
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => {
      resolve()
    })
    socket.addEventListener('error', () => {
      reject(new Error('DevTools websocket connection failed'))
    })
  })
  const rpc = createBirpc<DevtoolsServerFunctions>(
    {},
    {
      post: (data: unknown) => {
        socket.send(JSON.stringify({ type: 'custom', event: DEVTOOLS_RPC_EVENT, data }))
      },
      on: (handler) => {
        socket.addEventListener('message', (event: MessageEvent<string>) => {
          const message: unknown = JSON.parse(event.data)
          if (isDevtoolsRpcMessage(message)) {
            handler(message.data)
          }
        })
      },
      serialize: stringify,
      deserialize: parse,
    },
  )
  return {
    rpc,
    close: () => {
      rpc.$close()
      socket.close()
    },
  }
}

type DevtoolsClient = Awaited<ReturnType<typeof connectDevtools>>

async function readDevtoolsAuthToken(devtools: DevtoolsClient, home: string): Promise<string> {
  // DevTools creates its auth token on first use; the browser UI gets it from this file via the terminal.
  await expect(devtools.rpc.verifyAuthToken('invalid-token')).resolves.toBe(false)
  return (await readFile(join(home, '.nuxt/devtools/dev-auth-token.txt'), 'utf8')).trim()
}

function readSessionCookie(response: Response): string {
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith('nuxt-oidc-auth='))
  if (cookie === undefined) {
    throw new Error('Expected a session cookie')
  }
  const value = cookie.slice('nuxt-oidc-auth='.length)
  const end = value.indexOf(';')
  return decodeURIComponent(end === -1 ? value : value.slice(0, end))
}

async function findFilesContaining(directory: string, needles: string[]): Promise<string[]> {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
  const contents = await Promise.all(files.map(async (file) => await readFile(file, 'utf8')))
  return files.filter((_, index) =>
    needles.some((needle) => contents[index]?.includes(needle) === true),
  )
}

// Starts a dev server with a DevTools client for the enclosing suite and always tears both down.
function useDevServer(environment: Record<string, string>): () => {
  server: Server
  devtools: DevtoolsClient
} {
  let server: Server | undefined
  let devtools: DevtoolsClient | undefined

  beforeAll(async () => {
    server = await startDevServer(environment)
    devtools = await connectDevtools(server.url)
  }, SERVER_TIMEOUT)

  afterAll(async () => {
    try {
      devtools?.close()
    } finally {
      await server?.stop()
    }
  }, SERVER_TIMEOUT)

  return () => {
    if (server === undefined || devtools === undefined) {
      throw new Error('Dev server is not running')
    }
    return { server, devtools }
  }
}

describe('generated secrets on a dev server with dev mode', () => {
  const context = useDevServer({})

  it('returns the secrets the server uses to an authenticated DevTools client only', async () => {
    const { server, devtools } = context()
    const token = await readDevtoolsAuthToken(devtools, server.home)
    const secrets = await devtools.rpc['nuxt-oidc-auth-rpc:getNuxtOidcAuthSecrets'](token)

    expect(secrets.sessionSecret).toHaveLength(48)
    expect(secrets.authSessionSecret).toHaveLength(48)
    expect(secrets.tokenKey.length).toBeGreaterThanOrEqual(44)

    const login = await fetch(`${server.url}/auth/dev/login`, { redirect: 'manual' })
    expect(login.status).toBe(302)
    const request = new IncomingMessage(new Socket())
    const session = await unsealSession(
      createEvent(request, new ServerResponse(request)),
      { password: secrets.sessionSecret },
      readSessionCookie(login),
    )
    expect(session.data).toMatchObject({ provider: 'dev' })

    const output = server.output()
    expect(output).toContain(DEVTOOLS_HINT)
    expect(output).toContain(
      `NUXT_OIDC_SESSION_SECRET=${secrets.sessionSecret.slice(0, 5)}[redacted]`,
    )
    expect(output).toContain(`NUXT_OIDC_TOKEN_KEY=${secrets.tokenKey.slice(0, 5)}[redacted]`)
    expect(output).toContain(
      `NUXT_OIDC_AUTH_SESSION_SECRET=${secrets.authSessionSecret.slice(0, 5)}[redacted]`,
    )
    for (const secret of Object.values(secrets)) {
      expect(findLeakedSecretFragment(output, secret)).toBeUndefined()
    }
  })

  it('rejects missing and invalid DevTools tokens', async () => {
    const { devtools } = context()
    await Promise.all(
      ['', 'invalid-token'].map(async (token) => {
        await expect(
          devtools.rpc['nuxt-oidc-auth-rpc:getNuxtOidcAuthSecrets'](token),
        ).rejects.toThrow('[Nuxt DevTools] Invalid dev auth token.')
      }),
    )
  })
})

describe('generated secrets on a dev server with DevTools authorization disabled', () => {
  const context = useDevServer({ NUXT_OIDC_TEST_DEVTOOLS_DISABLE_AUTHORIZATION: 'true' })

  it('rejects retrieval although DevTools accepts any token', async () => {
    const { devtools } = context()
    await expect(devtools.rpc.verifyAuthToken('')).resolves.toBe(true)

    await expect(devtools.rpc['nuxt-oidc-auth-rpc:getNuxtOidcAuthSecrets']('')).rejects.toThrow(
      '[nuxt-oidc-auth] Secrets are unavailable while Nuxt DevTools authorization is disabled.',
    )
  })
})

describe.each<{ reason: string; environment: Record<string, string> }>([
  { reason: 'in config', environment: { NUXT_OIDC_TEST_DEV_MODE: 'false' } },
  {
    reason: 'by a runtime env override of enabled config',
    environment: { NUXT_OIDC_DEV_MODE_ENABLED: 'false' },
  },
])('generated secrets on a dev server with dev mode disabled $reason', ({ environment }) => {
  const context = useDevServer(environment)

  it('neither shares generated secrets nor returns them to an authenticated client', async () => {
    const { server, devtools } = context()
    const token = await readDevtoolsAuthToken(devtools, server.home)

    await expect(devtools.rpc['nuxt-oidc-auth-rpc:getNuxtOidcAuthSecrets'](token)).rejects.toThrow(
      DEV_MODE_REQUIRED_ERROR,
    )
    expect(server.output()).not.toContain(DEVTOOLS_HINT)
  })
})

describe('generated secrets in a production build with dev mode configured', () => {
  let outputDir: string | undefined
  let server: Server | undefined
  let devtoolsRegistered: boolean | undefined

  beforeAll(async () => {
    outputDir = await mkdtemp(join(tmpdir(), 'nuxt-oidc-auth-production-'))
    // DevTools skips setup under test flags, so clear them to prove production disables it.
    vi.stubEnv('TEST', undefined)
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NUXT_OIDC_TEST_DEVTOOLS', 'true')
    try {
      const nuxt = await loadNuxt({
        cwd: fixtureDir,
        dev: false,
        overrides: {
          test: false,
          logLevel: 'silent',
          buildDir: join(outputDir, '.nuxt'),
          nitro: { output: { dir: join(outputDir, '.output') } },
        },
      })
      try {
        devtoolsRegistered = 'devtools' in nuxt
        await buildNuxt(nuxt)
      } finally {
        await nuxt.close()
      }
    } finally {
      vi.unstubAllEnvs()
    }
    server = await startServer(
      [join(outputDir, '.output/server/index.mjs')],
      { NODE_ENV: 'production', NUXT_OIDC_DEV_MODE_ENABLED: 'true' },
      'Listening on',
    )
  }, SERVER_TIMEOUT)

  afterAll(async () => {
    try {
      await server?.stop()
    } finally {
      if (outputDir !== undefined) {
        await rm(outputDir, { recursive: true, force: true })
      }
    }
  }, SERVER_TIMEOUT)

  function running(): { server: Server; outputDir: string } {
    if (server === undefined || outputDir === undefined) {
      throw new Error('Production server is not running')
    }
    return { server, outputDir }
  }

  it('does not register DevTools or bundle the secret RPC or dev routes', async () => {
    const { server: production, outputDir: output } = running()
    expect(devtoolsRegistered).toBe(false)
    await expect(
      findFilesContaining(join(output, '.output/server'), [
        'getNuxtOidcAuthSecrets',
        'nuxt-oidc-auth-rpc',
      ]),
    ).resolves.toStrictEqual([])

    const devLogin = await fetch(`${production.url}/auth/dev/login`, { redirect: 'manual' })
    expect(devLogin.status).toBe(404)
    const login = await fetch(`${production.url}/auth/login`, { redirect: 'manual' })
    expect(login.headers.get('location')).toBe('/auth/oidc/login')
  })

  it('prints only a five-character secret prefix when runtime config enables dev mode', () => {
    const output = running().server.output()
    const logged = output.match(SECRET_LOG_RE) ?? []
    expect(logged).toHaveLength(SECRET_NAMES.length)
    expect(output.match(PREFIXED_SECRET_LOG_RE)).toHaveLength(logged.length)
  })
})
