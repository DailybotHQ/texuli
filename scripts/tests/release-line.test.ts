/**
 * The release line (docs/RELEASE.md, parsed by scripts/release-line.ts) is
 * the single source of truth for "what npm has". The manifests, the exact
 * internal pins and the install copy must agree with it: while a version is
 * in development, every published manifest carries it, and the copy still
 * tells people to install the published line.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inPublishedLine, isLineVersion, parseReleaseLine, releaseLine } from '../release-line.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

interface Manifest {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const manifests: Manifest[] = readdirSync(join(ROOT, 'packages'))
  .map((dir) => JSON.parse(read(`packages/${dir}/package.json`)) as Manifest)
  .filter((manifest) => manifest.name !== '@texuli/examples');
const names = new Set(manifests.map((manifest) => manifest.name));
const line = releaseLine();

describe('the release line', () => {
  it('parses the field, with or without a version in development', () => {
    expect(parseReleaseLine('Release line: published `0.8` · in development `0.9.0`\n')).toEqual({
      published: '0.8',
      development: '0.9.0',
    });
    expect(parseReleaseLine('x\nRelease line: published `0.9`\n')).toEqual({
      published: '0.9',
      development: null,
    });
    expect(() => parseReleaseLine('no field here')).toThrow(/Release line/);
    expect(inPublishedLine('0.8.2', line)).toBe(line.published === '0.8');
    expect(inPublishedLine('0.80.0', { published: '0.8', development: null })).toBe(false);
  });

  it('keeps the version in development ahead of the published line', () => {
    if (!line.development) return;
    expect(inPublishedLine(line.development, line)).toBe(false);
    const [major, minor] = line.published.split('.').map(Number) as [number, number];
    const [devMajor, devMinor] = line.development.split('.').map(Number) as [number, number];
    expect(devMajor * 1000 + devMinor).toBeGreaterThan(major * 1000 + minor);
  });

  it('matches every published manifest and its exact internal pins', () => {
    // 25 packages on npm plus @texuli/mcp, first published in 0.9.0.
    expect(manifests).toHaveLength(26);
    const versions = new Map(manifests.map((manifest) => [manifest.name, manifest.version]));
    const wrong: string[] = [];
    for (const manifest of manifests) {
      // A version opens once: in development, every published package carries it.
      const ok = line.development
        ? manifest.version === line.development
        : isLineVersion(manifest.version, line);
      if (!ok) wrong.push(`${manifest.name}@${manifest.version}`);
      for (const field of ['dependencies', 'peerDependencies', 'devDependencies'] as const) {
        for (const [dep, range] of Object.entries(manifest[field] ?? {})) {
          if (names.has(dep) && range !== versions.get(dep))
            wrong.push(`${manifest.name} ${field} ${dep}@${range}`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('tells people to install the published line, and names the version in development', () => {
    const published = `on npm in the ${line.published} line`;
    for (const path of [
      'AGENTS.md',
      'README.md',
      'docs/PRODUCT_SPEC.md',
      'docs/RELEASE.md',
      'skills/texuli/SKILL.md',
      'skills/texuli/router/packages.md',
    ])
      expect(read(path).replace(/\s+/g, ' '), path).toContain(published);
    // The install instructions pin the published line, never the version in development.
    for (const path of [
      'README.md',
      'skills/texuli/SKILL.md',
      'skills/texuli/components/references/install.md',
      'apps/website/src/pages/guides/getting-started/index.astro',
    ]) {
      const text = read(path);
      expect(text, path).toContain(`^${line.published}.0`);
      if (line.development) expect(text, path).not.toMatch(new RegExp(`[~^@]${line.development}`));
    }
    if (!line.development) return;
    for (const path of ['AGENTS.md', 'README.md', 'docs/PRODUCT_SPEC.md'])
      expect(read(path).replace(/\s+/g, ' '), path).toMatch(
        new RegExp(`\`?${line.development.replaceAll('.', '\\.')}\`? is in development`)
      );
    expect(read('docs/RELEASE.md')).toContain(`### ${line.development} (in development)`);
    for (const path of ['skills/texuli/SKILL.md', 'skills/texuli/components/references/install.md'])
      expect(read(path).replace(/\s+/g, ' '), path).toContain(
        `${line.development} is in development and not on npm, so install the ${line.published} line`
      );
  });
});
