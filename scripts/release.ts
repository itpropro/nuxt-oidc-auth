#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const semverPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$/

interface RepositoryState {
  branch: string | undefined
  clean: boolean
  head: string
  originMain: string
}

export interface PublicationState extends RepositoryState {
  changelog: string
  localTagCommit?: string
  npmVersion?: string
  packageVersion: string
  remoteTagCommit?: string
  verifiedCommit: string
}

interface PreparationState extends RepositoryState {
  changelog: string
  currentVersion: string
  localTagCommit?: string
  npmVersion?: string
  remoteTagCommit?: string
  targetVersion: string
}

interface PackageJson {
  name: string
  version: string
}

interface CommandOptions {
  allowedStatuses?: number[]
  inherit?: boolean
}

function commandFailure(command: string, args: string[], output: string) {
  const detail = output.trim()
  return new Error(`Command failed: ${command} ${args.join(' ')}${detail ? `\n${detail}` : ''}`)
}

function execute(command: string, args: string[], options: CommandOptions = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe',
  })
  if (result.error) throw result.error

  const allowedStatuses = options.allowedStatuses ?? [0]
  if (result.status === null || !allowedStatuses.includes(result.status)) {
    throw commandFailure(command, args, `${result.stdout ?? ''}${result.stderr ?? ''}`)
  }
  return result
}

function git(args: string[], options?: CommandOptions) {
  return execute('git', args, options)
}

function readPackageJson(): PackageJson {
  return JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8')) as PackageJson
}

function readChangelog() {
  return readFileSync(resolve(repositoryRoot, 'CHANGELOG.md'), 'utf8')
}

function validateVersion(version: string) {
  if (!semverPattern.test(version)) throw new Error(`Invalid release version: ${version}`)
}

function hasChangelogEntry(changelog: string, version: string) {
  return changelog.split(/\r?\n/).includes(`## v${version}`)
}

function assertExactOriginMain(state: RepositoryState) {
  if (!state.clean) throw new Error('Working tree must be clean')
  if (state.head !== state.originMain) {
    throw new Error(`HEAD ${state.head} must equal origin/main ${state.originMain}`)
  }
}

function assertPublicationRepositoryState(state: RepositoryState) {
  assertExactOriginMain(state)
  if (state.branch !== 'main') {
    throw new Error(`Release must run on main; found ${state.branch ?? 'detached HEAD'}`)
  }
}

function assertTagAvailable(
  tag: string,
  head: string,
  localTagCommit?: string,
  remoteTagCommit?: string,
) {
  for (const [location, commit] of [
    ['Local', localTagCommit],
    ['Remote', remoteTagCommit],
  ] as const) {
    if (!commit) continue
    if (commit !== head)
      throw new Error(`${location} tag ${tag} points to ${commit}, not HEAD ${head}`)
    throw new Error(`${location} tag ${tag} already exists at HEAD`)
  }
}

export function assertPreparationState(state: PreparationState) {
  assertExactOriginMain(state)
  validateVersion(state.targetVersion)
  if (state.targetVersion === state.currentVersion) {
    throw new Error(`Package already has version ${state.targetVersion}`)
  }
  if (hasChangelogEntry(state.changelog, state.targetVersion)) {
    throw new Error(`CHANGELOG.md already contains v${state.targetVersion}`)
  }
  if (state.npmVersion) throw new Error(`npm version ${state.npmVersion} already exists`)
  assertTagAvailable(
    `v${state.targetVersion}`,
    state.head,
    state.localTagCommit,
    state.remoteTagCommit,
  )
}

export function assertPublicationState(state: PublicationState) {
  assertPublicationRepositoryState(state)
  validateVersion(state.packageVersion)
  if (state.verifiedCommit !== state.head) {
    throw new Error(`Provider E2E commit ${state.verifiedCommit} does not match HEAD ${state.head}`)
  }
  if (!hasChangelogEntry(state.changelog, state.packageVersion)) {
    throw new Error(`CHANGELOG.md is missing "## v${state.packageVersion}"`)
  }
  if (state.npmVersion) throw new Error(`npm version ${state.npmVersion} already exists`)
  assertTagAvailable(
    `v${state.packageVersion}`,
    state.head,
    state.localTagCommit,
    state.remoteTagCommit,
  )
}

export function assertSignedTag(tag: string, tagCommit: string, head: string, contents: string) {
  if (tagCommit !== head) throw new Error(`Tag ${tag} points to ${tagCommit}, not HEAD ${head}`)
  if (!/-----BEGIN (?:SSH|PGP) SIGNATURE-----/.test(contents)) {
    throw new Error(`Tag ${tag} is not signed`)
  }
}

function collectRepositoryState(): RepositoryState {
  git(['fetch', '--quiet', 'origin', 'main'])
  const branchResult = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], {
    allowedStatuses: [0, 1],
  })
  return {
    branch: branchResult.status === 0 ? branchResult.stdout.trim() : undefined,
    clean: git(['status', '--porcelain', '--untracked-files=normal']).stdout.trim() === '',
    head: git(['rev-parse', 'HEAD']).stdout.trim(),
    originMain: git(['rev-parse', 'refs/remotes/origin/main']).stdout.trim(),
  }
}

function localTagCommit(tag: string) {
  const result = git(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`], {
    allowedStatuses: [0, 1],
  })
  return result.status === 0 ? result.stdout.trim() : undefined
}

function remoteTagCommit(tag: string) {
  const result = git(
    ['ls-remote', '--exit-code', '--tags', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`],
    { allowedStatuses: [0, 2] },
  )
  if (result.status === 2) return
  const refs = result.stdout.trim().split(/\r?\n/).filter(Boolean)
  const peeled = refs.find((line) => line.endsWith('^{}')) ?? refs[0]
  return peeled?.split(/\s+/)[0]
}

function publishedVersion(packageName: string, version: string) {
  const args = ['view', `${packageName}@${version}`, 'version', '--json']
  const result = execute('pnpm', args, { allowedStatuses: [0, 1] })
  if (result.status === 0) {
    const value = JSON.parse(result.stdout) as string
    return value
  }

  try {
    const value = JSON.parse(result.stdout) as { error?: { code?: string } }
    if (value.error?.code === 'E404') return
  } catch {
    // Command failure below includes npm's original output.
  }
  throw commandFailure('pnpm', args, `${result.stdout}${result.stderr}`)
}

function collectTagState(packageName: string, version: string) {
  const tag = `v${version}`
  return {
    localTagCommit: localTagCommit(tag),
    npmVersion: publishedVersion(packageName, version),
    remoteTagCommit: remoteTagCommit(tag),
  }
}

function parsePrepareArguments(args: string[]) {
  const [version, flag, from, ...rest] = args
  if (!version || rest.length || (flag && flag !== '--from') || (flag === '--from' && !from)) {
    throw new Error('Usage: pnpm release:prepare -- <version> [--from <commit>]')
  }
  return { from, version }
}

function prepare(args: string[]) {
  const { from, version } = parsePrepareArguments(args)
  const packageJson = readPackageJson()
  const state = {
    ...collectRepositoryState(),
    ...collectTagState(packageJson.name, version),
    changelog: readChangelog(),
    currentVersion: packageJson.version,
    targetVersion: version,
  }
  assertPreparationState(state)

  if (from) git(['rev-parse', '--verify', '--end-of-options', `${from}^{commit}`])
  execute(
    'pnpm',
    ['exec', 'changelogen', '--bump', '-r', version, ...(from ? ['--from', from] : [])],
    { inherit: true },
  )

  const updatedPackage = readPackageJson()
  if (updatedPackage.version !== version) {
    throw new Error(`Expected package version ${version}, found ${updatedPackage.version}`)
  }
  if (!hasChangelogEntry(readChangelog(), version)) {
    throw new Error(`CHANGELOG.md is missing generated entry for v${version}`)
  }
  console.log(
    `Prepared v${version}. Review and commit package.json and CHANGELOG.md before release.`,
  )
}

function publish(args: string[]) {
  const [verifiedCommit, ...rest] = args
  if (!verifiedCommit || rest.length) {
    throw new Error('Usage: pnpm release:publish -- <provider-e2e-commit>')
  }

  const packageJson = readPackageJson()
  const resolvedVerifiedCommit = git([
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${verifiedCommit}^{commit}`,
  ]).stdout.trim()
  const state = {
    ...collectRepositoryState(),
    ...collectTagState(packageJson.name, packageJson.version),
    changelog: readChangelog(),
    packageVersion: packageJson.version,
    verifiedCommit: resolvedVerifiedCommit,
  }
  assertPublicationState(state)

  const tag = `v${packageJson.version}`
  let npmPublished = false
  git(['tag', '-s', tag, '-m', tag], { inherit: true })
  try {
    const tagCommit = localTagCommit(tag)
    if (!tagCommit) throw new Error(`Unable to resolve created tag ${tag}`)
    const tagContents = git(['cat-file', '-p', `refs/tags/${tag}`]).stdout
    assertSignedTag(tag, tagCommit, state.head, tagContents)

    execute('pnpm', ['publish', '--access=public'], { inherit: true })
    npmPublished = true
    git(['push', 'origin', `refs/tags/${tag}`], { inherit: true })
  } catch (error) {
    if (!npmPublished) {
      git(['tag', '--delete', tag], { inherit: true })
    } else {
      console.error(`npm publication succeeded. Recover by pushing existing signed tag ${tag}.`)
    }
    throw error
  }
  console.log(`Published ${packageJson.name}@${packageJson.version} and pushed signed tag ${tag}.`)
}

function main() {
  const [command, ...args] = process.argv.slice(2)
  const commandArgs = args[0] === '--' ? args.slice(1) : args
  if (command === 'prepare') return prepare(commandArgs)
  if (command === 'publish') return publish(commandArgs)
  throw new Error('Usage: release.ts <prepare|publish> [...args]')
}

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined
if (entrypoint === import.meta.url) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
