import { describe, expect, it } from 'vitest'
import {
  assertCIPublicationState,
  assertPreparationState,
  assertSignedTag,
  assertTaggingState,
  type CIPublicationState,
  type PublicationState,
} from '../../../scripts/release'

const head = '1111111111111111111111111111111111111111'
const otherCommit = '2222222222222222222222222222222222222222'
const version = '1.0.0-beta.12'

function publicationState(overrides: Partial<PublicationState> = {}): PublicationState {
  return {
    branch: 'main',
    changelog: `# Changelog\n\n## v${version}\n\nRelease notes.\n`,
    clean: true,
    head,
    originMain: head,
    packageVersion: version,
    verifiedCommit: head,
    ...overrides,
  }
}

function ciPublicationState(overrides: Partial<CIPublicationState> = {}): CIPublicationState {
  return {
    ...publicationState({ branch: undefined }),
    localTagCommit: head,
    remoteTagCommit: head,
    ...overrides,
  }
}

describe('release provenance', () => {
  it('accepts clean exact-main tagging state', () => {
    expect(() => assertTaggingState(publicationState())).not.toThrow()
  })

  it.each([
    [{ clean: false }, 'Working tree must be clean'],
    [{ branch: 'release/beta.12' }, 'Tagging must run on main'],
    [{ branch: undefined }, 'detached HEAD'],
    [{ originMain: otherCommit }, 'must equal origin/main'],
    [{ verifiedCommit: otherCommit }, 'does not match HEAD'],
    [{ changelog: '# Changelog\n' }, 'CHANGELOG.md is missing'],
    [{ npmVersion: version }, `npm version ${version} already exists`],
    [{ localTagCommit: head }, `Local tag v${version} already exists at HEAD`],
    [{ localTagCommit: otherCommit }, `Local tag v${version} points to`],
    [{ remoteTagCommit: head }, `Remote tag v${version} already exists at HEAD`],
    [{ remoteTagCommit: otherCommit }, `Remote tag v${version} points to`],
  ] satisfies Array<[Partial<PublicationState>, string]>)(
    'rejects invalid publication state %#',
    (overrides, message) => {
      expect(() => assertTaggingState(publicationState(overrides))).toThrow(message)
    },
  )

  it('accepts a detached exact-main publish with matching signed-tag refs', () => {
    expect(() => assertCIPublicationState(ciPublicationState())).not.toThrow()
  })

  it.each([
    [{ clean: false }, 'Working tree must be clean'],
    [{ branch: 'main' }, 'must use a detached tag checkout'],
    [{ originMain: otherCommit }, 'must equal origin/main'],
    [{ verifiedCommit: otherCommit }, 'does not match HEAD'],
    [{ npmVersion: version }, `npm version ${version} already exists`],
    [{ localTagCommit: otherCommit }, `Local tag v${version} points to`],
    [{ remoteTagCommit: otherCommit }, `Remote tag v${version} points to`],
  ] satisfies Array<[Partial<CIPublicationState>, string]>)(
    'rejects invalid CI publication state %#',
    (overrides, message) => {
      expect(() => assertCIPublicationState(ciPublicationState(overrides))).toThrow(message)
    },
  )

  it('rejects an existing prepared version', () => {
    expect(() =>
      assertPreparationState({
        ...publicationState(),
        currentVersion: version,
        targetVersion: version,
      }),
    ).toThrow(`Package already has version ${version}`)
  })

  it('allows preparation on a review branch created from origin/main', () => {
    expect(() =>
      assertPreparationState({
        ...publicationState({ branch: 'release/beta.12', changelog: '# Changelog\n' }),
        currentVersion: '1.0.0-beta.11',
        targetVersion: version,
      }),
    ).not.toThrow()
  })

  it('requires created tag to be signed and point to HEAD', () => {
    expect(() =>
      assertSignedTag(`v${version}`, otherCommit, head, '-----BEGIN SSH SIGNATURE-----'),
    ).toThrow('not HEAD')
    expect(() => assertSignedTag(`v${version}`, head, head, 'unsigned')).toThrow('is not signed')
    expect(() =>
      assertSignedTag(`v${version}`, head, head, '-----BEGIN SSH SIGNATURE-----'),
    ).not.toThrow()
  })
})
