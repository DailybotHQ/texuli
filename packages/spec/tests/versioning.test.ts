// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPEC_VERSION } from '../src/version.ts';
import {
  checkVersionHistory,
  nextSpecVersion,
  type SpecVersionHistory,
} from '../src/versioning.ts';
import { build } from './helpers.ts';

/**
 * Digest pinning (Task 147) and the versioning policy (Task 148): every
 * released spec version is pinned to its digest in versions.json, and a
 * normative change without a new version fails here.
 */
// versions.json is not a normative file: it pins the digest of the normative files.
const history = JSON.parse(
  readFileSync(join(import.meta.dirname, '../versions.json'), 'utf8')
) as SpecVersionHistory;

describe('the spec version and digest are pinned', () => {
  it('pins the spec as built now to the newest release', () => {
    expect(build.stamp.specVersion).toBe(SPEC_VERSION);
    expect(checkVersionHistory(history, build.stamp)).toEqual([]);
    expect(history.releases.at(-1)).toMatchObject({
      specVersion: SPEC_VERSION,
      specDigest: build.stamp.specDigest,
    });
  });

  it('fails a normative change that kept the version', () => {
    const changed = { specVersion: SPEC_VERSION, specDigest: 'f'.repeat(64) };
    expect(checkVersionHistory(history, changed).map((i) => i.message)).toEqual([
      expect.stringContaining('changed without a new version'),
    ]);
  });

  it('fails a version bump with no pin', () => {
    const bumped = {
      specVersion: nextSpecVersion(SPEC_VERSION, 'minor'),
      specDigest: 'a'.repeat(64),
    };
    expect(checkVersionHistory(history, bumped)[0]?.message).toContain('the newest release');
  });
});

describe('the versioning policy', () => {
  it.each([
    ['0.2.0', 'patch', '0.2.1'],
    ['0.2.0', 'minor', '0.3.0'],
    ['0.2.0', 'major', '0.3.0'],
    ['1.4.2', 'patch', '1.4.3'],
    ['1.4.2', 'minor', '1.5.0'],
    ['1.4.2', 'major', '2.0.0'],
  ] as const)('after %s, a %s change is %s', (from, change, to) => {
    expect(nextSpecVersion(from, change)).toBe(to);
  });

  const pin = (
    specVersion: string,
    change: string,
    specDigest: string | null = 'b'.repeat(64)
  ) => ({
    specVersion,
    specDigest,
    change,
    summary: 'x',
  });
  const now = { specVersion: '0.3.0', specDigest: 'b'.repeat(64) };

  it.each([
    [
      'a step that does not match the change class',
      [pin('0.1.0', 'initial', null), pin('0.3.0', 'minor')],
      'is 0.2.0',
    ],
    [
      'a second initial release',
      [pin('0.1.0', 'initial', null), pin('0.3.0', 'initial')],
      'only the first',
    ],
    [
      'a later release without a digest',
      [pin('0.1.0', 'initial', null), pin('0.2.0', 'minor'), pin('0.3.0', 'minor', null)],
      'lack a digest',
    ],
    ['a first release that is not initial', [pin('0.3.0', 'minor')], 'must have change "initial"'],
    [
      'a digest that is not SHA-256 hex',
      [pin('0.1.0', 'initial', null), pin('0.2.0', 'minor'), pin('0.3.0', 'minor', 'xyz')],
      'SHA-256',
    ],
  ])('refuses %s', (_label, releases, message) => {
    const issues = checkVersionHistory({ releases } as SpecVersionHistory, now);
    expect(issues.map((i) => i.message).join(' | ')).toContain(message);
  });

  it('accepts a well-formed history', () => {
    const releases = [
      pin('0.1.0', 'initial', null),
      pin('0.2.0', 'minor'),
      pin('0.2.1', 'patch'),
      pin('0.3.0', 'major'),
    ];
    expect(checkVersionHistory({ releases } as SpecVersionHistory, now)).toEqual([]);
  });
});
