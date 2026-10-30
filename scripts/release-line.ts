/**
 * The release line: the single source of truth for which version line npm
 * has (`published`) and which version the workspace manifests are working
 * toward (`development`, or `null` when the manifests are the published
 * versions). It lives as one line in docs/RELEASE.md ("Current npm status"):
 *
 *   Release line: published `0.9`
 *
 * (while a version is open: published `0.9` · in development `0.10.0`)
 *
 * Tests and honesty checks read it here instead of hardcoding a version, so
 * opening or publishing a version changes one line, and every check that
 * compares copy with npm follows.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ReleaseLine {
  /** The `major.minor` line npm has, for example `0.8`. */
  readonly published: string;
  /** The version the manifests carry while it is not on npm, or `null`. */
  readonly development: string | null;
}

const ROOT = join(import.meta.dirname, '..');
export const RELEASE_DOC = join(ROOT, 'docs', 'RELEASE.md');

const LINE = /^Release line: published `(\d+\.\d+)`(?: · in development `(\d+\.\d+\.\d+)`)?\s*$/m;

/** Parses the release line out of the text of docs/RELEASE.md. */
export function parseReleaseLine(markdown: string): ReleaseLine {
  const match = LINE.exec(markdown);
  if (!match?.[1]) throw new Error('docs/RELEASE.md carries no "Release line:" field');
  return { published: match[1], development: match[2] ?? null };
}

/** The release line of this checkout. */
export function releaseLine(path: string = RELEASE_DOC): ReleaseLine {
  return parseReleaseLine(readFileSync(path, 'utf8'));
}

/** Whether `version` belongs to the published line (`0.8.0`, `0.8.2`…). */
export function inPublishedLine(version: string, line: ReleaseLine = releaseLine()): boolean {
  return version.startsWith(`${line.published}.`) && /^\d+\.\d+\.\d+$/.test(version);
}

/**
 * Whether a published package's manifest version is one this release line
 * allows: a version of the published line, or the version in development.
 */
export function isLineVersion(version: string, line: ReleaseLine = releaseLine()): boolean {
  return inPublishedLine(version, line) || version === line.development;
}
