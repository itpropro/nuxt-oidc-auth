#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const semverPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$/u
const lineBreakPattern = /\r?\n/u
const signaturePattern = /-----BEGIN (?:SSH|PGP) SIGNATURE-----/u
const providerCommitPattern = /^Provider-E2E-Commit: ([0-9a-f]{40})$/mu
const whitespacePattern = /\s+/u

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

export interface CIPublicationState extends PublicationState {
  localTagCommit: string
  originMainContainsHead: boolean
  remoteTagCommit: string
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
    stdio: options.inherit === true ? 'inherit' : 'pipe',
  })
  if (result.error) {
    throw result.error
  }

  const allowedStatuses = options.allowedStatuses ?? [0]
  if (result.status === null || !allowedStatuses.includes(result.status)) {
    const output = options.inherit === true ? '' : `${result.stdout}${result.stderr}`
    throw commandFailure(command, args, output)
  }
  return result
}

function git(args: string[], options?: CommandOptions) {
  return execute('git', args, options)
}

function readPackageJson(): PackageJson {
  const value: unknown = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'))
  if (
    typeof value !== 'object' ||
    value === null ||
    !('name' in value) ||
    typeof value.name !== 'string' ||
    !('version' in value) ||
    typeof value.version !== 'string'
  ) {
    throw new Error('package.json must contain a package name and version')
  }
  return { name: value.name, version: value.version }
}

function readChangelog() {
  return readFileSync(resolve(repositoryRoot, 'CHANGELOG.md'), 'utf8')
}

function validateVersion(version: string) {
  if (!semverPattern.test(version)) {
    throw new Error(`Invalid release version: ${version}`)
  }
}

function hasChangelogEntry(changelog: string, version: string) {
  return changelog.split(lineBreakPattern).includes(`## v${version}`)
}

function assertExactOriginMain(state: RepositoryState) {
  if (!state.clean) {
    throw new Error('Working tree must be clean')
  }
  if (state.head !== state.originMain) {
    throw new Error(`HEAD ${state.head} must equal origin/main ${state.originMain}`)
  }
}

function assertTaggingRepositoryState(state: RepositoryState) {
  assertExactOriginMain(state)
  if (state.branch !== 'main') {
    throw new Error(`Tagging must run on main; found ${state.branch ?? 'detached HEAD'}`)
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
    if (commit === undefined || commit === '') {
      continue
    }
    if (commit !== head) {
      throw new Error(`${location} tag ${tag} points to ${commit}, not HEAD ${head}`)
    }
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
  if (state.npmVersion !== undefined && state.npmVersion !== '') {
    throw new Error(`npm version ${state.npmVersion} already exists`)
  }
  assertTagAvailable(
    `v${state.targetVersion}`,
    state.head,
    state.localTagCommit,
    state.remoteTagCommit,
  )
}

function assertReleaseContents(state: PublicationState) {
  validateVersion(state.packageVersion)
  if (state.verifiedCommit !== state.head) {
    throw new Error(`Provider E2E commit ${state.verifiedCommit} does not match HEAD ${state.head}`)
  }
  if (!hasChangelogEntry(state.changelog, state.packageVersion)) {
    throw new Error(`CHANGELOG.md is missing "## v${state.packageVersion}"`)
  }
  if (state.npmVersion !== undefined && state.npmVersion !== '') {
    throw new Error(`npm version ${state.npmVersion} already exists`)
  }
}

export function assertTaggingState(state: PublicationState) {
  assertTaggingRepositoryState(state)
  assertReleaseContents(state)
  assertTagAvailable(
    `v${state.packageVersion}`,
    state.head,
    state.localTagCommit,
    state.remoteTagCommit,
  )
}

export function assertCIPublicationState(state: CIPublicationState) {
  if (!state.clean) {
    throw new Error('Working tree must be clean')
  }
  if (!state.originMainContainsHead) {
    throw new Error(`Release commit ${state.head} must be an ancestor of origin/main`)
  }
  if (state.branch !== undefined) {
    throw new Error(`CI publication must use a detached tag checkout; found ${state.branch}`)
  }
  assertReleaseContents(state)

  const tag = `v${state.packageVersion}`
  for (const [location, commit] of [
    ['Local', state.localTagCommit],
    ['Remote', state.remoteTagCommit],
  ] as const) {
    if (commit !== state.head) {
      throw new Error(`${location} tag ${tag} points to ${commit}, not HEAD ${state.head}`)
    }
  }
}

export function assertSignedTag(tag: string, tagCommit: string, head: string, contents: string) {
  if (tagCommit !== head) {
    throw new Error(`Tag ${tag} points to ${tagCommit}, not HEAD ${head}`)
  }
  if (!signaturePattern.test(contents)) {
    throw new Error(`Tag ${tag} is not signed`)
  }

  const providerCommit = providerCommitPattern.exec(contents)?.[1]
  if (providerCommit === undefined || providerCommit === '') {
    throw new Error(`Tag ${tag} is missing Provider-E2E-Commit`)
  }
  if (providerCommit !== head) {
    throw new Error(`Tag ${tag} records Provider E2E commit ${providerCommit}, not HEAD ${head}`)
  }
  return providerCommit
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

function isAncestor(ancestor: string, descendant: string) {
  return (
    git(['merge-base', '--is-ancestor', ancestor, descendant], { allowedStatuses: [0, 1] })
      .status === 0
  )
}

function resolveLocalTagCommit(tag: string) {
  const result = git(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`], {
    allowedStatuses: [0, 1],
  })
  return result.status === 0 ? result.stdout.trim() : undefined
}

function resolveRemoteTagCommit(tag: string): string | undefined {
  const result = git(
    ['ls-remote', '--exit-code', '--tags', 'origin', `refs/tags/${tag}`, `refs/tags/${tag}^{}`],
    { allowedStatuses: [0, 2] },
  )
  const refs = result.stdout.trim().split(lineBreakPattern).filter(Boolean)
  const peeled = refs.find((line) => line.endsWith('^{}')) ?? refs[0]
  return result.status === 2 ? undefined : peeled?.split(whitespacePattern)[0]
}

export function isMissingPackageVersion(output: string) {
  try {
    const value: unknown = JSON.parse(output)
    if (typeof value !== 'object' || value === null || !('error' in value)) {
      return false
    }
    const error = value.error
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 'E404' || error.code === 'ERR_PNPM_PACKAGE_NOT_FOUND')
    )
  } catch {
    return false
  }
}

function publishedVersion(packageName: string, version: string): string | undefined {
  const args = ['view', `${packageName}@${version}`, 'version', '--json']
  const result = execute('pnpm', args, { allowedStatuses: [0, 1] })
  let npmVersion: string | undefined
  if (result.status === 0) {
    const value: unknown = JSON.parse(result.stdout)
    if (typeof value !== 'string') {
      throw new TypeError(`Unexpected npm version response for ${packageName}@${version}`)
    }
    npmVersion = value
  } else if (!isMissingPackageVersion(result.stdout)) {
    throw commandFailure('pnpm', args, `${result.stdout}${result.stderr}`)
  }
  return npmVersion
}

function collectTagState(packageName: string, version: string) {
  const tag = `v${version}`
  return {
    localTagCommit: resolveLocalTagCommit(tag),
    npmVersion: publishedVersion(packageName, version),
    remoteTagCommit: resolveRemoteTagCommit(tag),
  }
}

function verifySignedTag(tag: string, head: string) {
  const tagCommit = resolveLocalTagCommit(tag)
  if (tagCommit === undefined || tagCommit === '') {
    throw new Error(`Unable to resolve tag ${tag}`)
  }
  const tagContents = git(['cat-file', '-p', `refs/tags/${tag}`]).stdout
  const providerCommit = assertSignedTag(tag, tagCommit, head, tagContents)
  git([
    '-c',
    `gpg.ssh.allowedSignersFile=${resolve(repositoryRoot, '.github/release-allowed-signers')}`,
    'verify-tag',
    tag,
  ])
  return providerCommit
}

function parsePrepareArguments(args: string[]) {
  const [version, flag, from, ...rest] = args
  if (
    version === undefined ||
    version === '' ||
    rest.length > 0 ||
    (flag !== undefined && flag !== '' && flag !== '--from') ||
    (flag === '--from' && (from === undefined || from === ''))
  ) {
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

  if (from !== undefined && from !== '') {
    git(['rev-parse', '--verify', '--end-of-options', `${from}^{commit}`])
  }
  execute(
    'pnpm',
    [
      'exec',
      'changelogen',
      '--bump',
      '-r',
      version,
      ...(from !== undefined && from !== '' ? ['--from', from] : []),
    ],
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

function parseVerifiedCommit(args: string[]) {
  const [verifiedCommit, ...rest] = args
  if (verifiedCommit === undefined || verifiedCommit === '' || rest.length > 0) {
    throw new Error('Usage: pnpm release:tag -- <provider-e2e-commit>')
  }

  return git([
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${verifiedCommit}^{commit}`,
  ]).stdout.trim()
}

function publishTag(args: string[]) {
  const resolvedVerifiedCommit = parseVerifiedCommit(args)

  const packageJson = readPackageJson()
  const state = {
    ...collectRepositoryState(),
    ...collectTagState(packageJson.name, packageJson.version),
    changelog: readChangelog(),
    packageVersion: packageJson.version,
    verifiedCommit: resolvedVerifiedCommit,
  }
  assertTaggingState(state)

  const tag = `v${packageJson.version}`
  git(['tag', '-s', tag, '-m', tag, '-m', `Provider-E2E-Commit: ${resolvedVerifiedCommit}`], {
    inherit: true,
  })
  let verified = false
  try {
    verifySignedTag(tag, state.head)
    verified = true
    git(['push', 'origin', `refs/tags/${tag}`], { inherit: true })
  } catch (error) {
    if (verified) {
      console.error(`Signed local tag ${tag} remains available for push recovery.`)
    } else {
      git(['tag', '--delete', tag], { inherit: true })
    }
    throw error
  }
  console.log(`Pushed signed tag ${tag}. Publish its GitHub release to trigger release.yml.`)
}

function validate(args: string[]) {
  if (process.env['GITHUB_ACTIONS'] !== 'true') {
    throw new Error('npm publication validation must run in GitHub Actions')
  }
  if (args.length > 0) {
    throw new Error('Usage: pnpm release:validate')
  }

  const packageJson = readPackageJson()
  const tag = `v${packageJson.version}`
  if (process.env['RELEASE_TAG'] !== tag) {
    throw new Error(
      `Release workflow tag ${process.env['RELEASE_TAG'] ?? '<unset>'} must equal ${tag}`,
    )
  }
  const tagState = collectTagState(packageJson.name, packageJson.version)
  if (
    tagState.localTagCommit === undefined ||
    tagState.localTagCommit === '' ||
    tagState.remoteTagCommit === undefined ||
    tagState.remoteTagCommit === ''
  ) {
    throw new Error(`Signed tag ${tag} must exist locally and on origin`)
  }
  const repositoryState = collectRepositoryState()
  const verifiedCommit = verifySignedTag(tag, repositoryState.head)
  const state: CIPublicationState = {
    ...repositoryState,
    ...tagState,
    changelog: readChangelog(),
    localTagCommit: tagState.localTagCommit,
    originMainContainsHead: isAncestor(repositoryState.head, repositoryState.originMain),
    packageVersion: packageJson.version,
    remoteTagCommit: tagState.remoteTagCommit,
    verifiedCommit,
  }
  assertCIPublicationState(state)

  console.log(`Validated ${packageJson.name}@${packageJson.version} from signed tag ${tag}.`)
}

function main() {
  const [command, ...args] = process.argv.slice(2)
  const commandArgs = args[0] === '--' ? args.slice(1) : args
  if (command === 'prepare') {
    prepare(commandArgs)
    return
  }
  if (command === 'tag') {
    publishTag(commandArgs)
    return
  }
  if (command === 'validate') {
    validate(commandArgs)
    return
  }
  throw new Error('Usage: release.ts <prepare|tag|validate> [...args]')
}

const entrypoint =
  process.argv[1] !== undefined && process.argv[1] !== ''
    ? pathToFileURL(resolve(process.argv[1])).href
    : undefined
if (entrypoint === import.meta.url) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
