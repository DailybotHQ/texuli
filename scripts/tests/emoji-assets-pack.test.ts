// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyPackages } from '../packages.ts';

const ROOT = resolve(import.meta.dirname, '../..');

describe('@texuli/emoji-assets packed contents', () => {
  it('packs every manifest SVG and export target into the tarball', async () => {
    const result = await verifyPackages({ root: ROOT, filters: ['emoji-assets'] });
    expect(result.packages).toHaveLength(1);
    const report = result.packages[0];
    expect(report?.ok, report?.problems.join('\n')).toBe(true);
    expect(report?.tarball).toBeDefined();

    const tarball = resolve(ROOT, report?.tarball ?? '');
    const members = new Set(
      execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).trim().split('\n')
    );
    const manifestSource = readFileSync(
      resolve(ROOT, 'packages/emoji-assets/src/manifest.ts'),
      'utf8'
    );
    const manifestMatch =
      /const manifestJson = `([\s\S]*?)`;\nexport const emojiAssetManifest/.exec(manifestSource);
    expect(manifestMatch?.[1]).toBeDefined();
    const assets = JSON.parse(manifestMatch?.[1] ?? '[]') as { path: string }[];
    for (const asset of assets) expect(members.has(`package/${asset.path.slice(2)}`)).toBe(true);

    const packedManifest = JSON.parse(
      execFileSync('tar', ['-xOf', tarball, 'package/package.json'], { encoding: 'utf8' })
    ) as { exports: Record<string, unknown> };
    const targets = (value: unknown): string[] => {
      if (typeof value === 'string') return value.startsWith('./') ? [value] : [];
      if (Array.isArray(value)) return value.flatMap(targets);
      if (value && typeof value === 'object') return Object.values(value).flatMap(targets);
      return [];
    };
    expect(members.has('package/package.json')).toBe(true);
    expect(members.has('package/dist/data/art-coverage.json')).toBe(true);
    expect(members.has('package/data/art-coverage.json')).toBe(true);
    for (const target of Object.values(packedManifest.exports).flatMap(targets))
      expect(members.has(`package/${target.slice(2)}`), `${target} is present in tarball`).toBe(
        true
      );
  }, 30_000);
});
