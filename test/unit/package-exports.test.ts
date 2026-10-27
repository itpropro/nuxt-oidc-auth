import { existsSync } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createNitro, writeTypes } from 'nitropack'
import { expect, it } from 'vitest'

const IMPORT_TYPE = /getUserSession: typeof import\('([^']+)'\)/u

it('lets Nitro type auto-imports from the exported session module', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'nuxt-oidc-auth-exports-'))
  try {
    // The package as an application installs it, with its real exports map
    const packageDir = join(rootDir, 'node_modules', 'nuxt-oidc-auth')
    const utilsDir = join(packageDir, 'dist', 'runtime', 'server', 'utils')
    await mkdir(utilsDir, { recursive: true })
    await copyFile(
      fileURLToPath(new URL('../../package.json', import.meta.url)),
      join(packageDir, 'package.json'),
    )
    await writeFile(join(utilsDir, 'session.js'), 'export function getUserSession() {}\n')
    await writeFile(
      join(utilsDir, 'session.d.ts'),
      'export declare function getUserSession(): void\n',
    )

    const nitro = await createNitro({
      rootDir,
      imports: {
        presets: [
          { from: 'nuxt-oidc-auth/runtime/server/utils/session.js', imports: ['getUserSession'] },
        ],
      },
    })
    await writeTypes(nitro)
    await nitro.close()

    const typesDir = join(nitro.options.buildDir, 'types')
    const importPath = IMPORT_TYPE.exec(
      await readFile(join(typesDir, 'nitro-imports.d.ts'), 'utf8'),
    )?.[1]
    expect(importPath).toBeDefined()
    expect(existsSync(`${resolve(typesDir, String(importPath))}.d.ts`)).toBe(true)
  } finally {
    await rm(rootDir, { force: true, recursive: true })
  }
})
