/**
 * The spec's version history (`versions.json`): every released spec version
 * pinned to the digest of its normative files, so the digest and the semantic
 * version cannot drift apart. A normative change (schema, catalog projection,
 * capability claim or fixture) changes the digest; it needs a new version
 * and a new pin, with the change class the policy assigns to it.
 */

/** What a release changes, by the policy in the package README. */
export type SpecChangeClass = 'patch' | 'minor' | 'major';

export interface SpecVersionPin {
  specVersion: string;
  /** The spec digest of that release, or `null` for a release pinned retroactively without one. */
  specDigest: string | null;
  change: SpecChangeClass | 'initial';
  summary: string;
}

export interface SpecVersionHistory {
  releases: readonly SpecVersionPin[];
}

export interface VersionIssue {
  version: string;
  message: string;
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const DIGEST = /^[0-9a-f]{64}$/;

function parts(version: string): [number, number, number] | null {
  const match = SEMVER.exec(version);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/**
 * The version that must follow `previous` for a change of `change` class.
 * Before 1.0.0 any change to accepted data (minor or major class) bumps the
 * minor number and a patch-class change bumps the patch; from 1.0.0 each
 * class bumps its own number.
 */
export function nextSpecVersion(previous: string, change: SpecChangeClass): string {
  const p = parts(previous);
  if (!p) throw new Error(`${previous}: not a semantic version`);
  const [major, minor, patch] = p;
  if (change === 'patch') return `${major}.${minor}.${patch + 1}`;
  if (major === 0 || change === 'minor') return `${major}.${minor + 1}.0`;
  return `${major + 1}.0.0`;
}

/**
 * Check the history and that the newest release is the spec as built now:
 * the same version and the same digest. Returns every problem; empty means
 * the version and the digest agree.
 */
export function checkVersionHistory(
  history: SpecVersionHistory,
  current: { specVersion: string; specDigest: string }
): VersionIssue[] {
  const issues: VersionIssue[] = [];
  const releases = history.releases;
  if (releases.length === 0) {
    return [{ version: current.specVersion, message: 'versions.json lists no release.' }];
  }
  releases.forEach((release, index) => {
    const { specVersion: version } = release;
    if (!parts(version)) issues.push({ version, message: 'not a semantic version' });
    if (release.specDigest !== null && !DIGEST.test(release.specDigest)) {
      issues.push({ version, message: 'the digest is not a SHA-256 hex string' });
    }
    if (index === 0) {
      if (release.change !== 'initial') {
        issues.push({ version, message: 'the first release must have change "initial"' });
      }
      return;
    }
    const previous = releases[index - 1] as SpecVersionPin;
    if (release.change === 'initial') {
      issues.push({ version, message: 'only the first release is "initial"' });
      return;
    }
    if (release.specDigest === null) {
      issues.push({ version, message: 'only the first release may lack a digest' });
    }
    if (parts(previous.specVersion)) {
      const expected = nextSpecVersion(previous.specVersion, release.change);
      if (version !== expected) {
        issues.push({
          version,
          message: `a ${release.change} change after ${previous.specVersion} is ${expected}`,
        });
      }
    }
  });
  const newest = releases[releases.length - 1] as SpecVersionPin;
  if (newest.specVersion !== current.specVersion) {
    issues.push({
      version: current.specVersion,
      message: `the newest release in versions.json is ${newest.specVersion}, the spec is ${current.specVersion}`,
    });
  } else if (newest.specDigest !== current.specDigest) {
    issues.push({
      version: current.specVersion,
      message:
        'the normative files changed without a new version: classify the change, bump SPEC_VERSION, regenerate, and append a release pinning the new digest',
    });
  }
  return issues;
}
