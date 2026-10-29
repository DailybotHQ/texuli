// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  compareParity,
  dependencyClosure,
  formatParity,
  moduleKey,
  PARITY_ROOTS,
  PARITY_TOLERANCE,
  type ParityBuild,
  ROOT,
  runParity,
} from '../dist-parity.ts';
import { readWorkspace } from '../packages.ts';

const build = (raw: number, gzip: number, keys: string[] = ['a (js)']): ParityBuild => ({
  files: keys.map((key, index) => ({
    file: `${index}.js`,
    key,
    raw: raw / keys.length,
    gzip: gzip / keys.length,
  })),
  raw,
  gzip,
});

describe('dist parity helpers', () => {
  it('pairs source and dist modules, closes over workspace dependencies and applies the tolerance', () => {
    const names = new Map([
      ['charts', '@texuli/charts'],
      ['texuli', 'texuli'],
    ]);
    expect(
      moduleKey(`${ROOT}/packages/charts/src/compact/Sparkline.svelte?svelte&type=style`, names)
    ).toBe('@texuli/charts/compact/Sparkline.svelte');
    expect(
      moduleKey('/x/dist/node_modules/@texuli/charts/dist/compact/shared.js', names, '/x')
    ).toBe('@texuli/charts/compact/shared');
    expect(moduleKey(`${ROOT}/packages/charts/src/compact/shared.ts`, names)).toBe(
      '@texuli/charts/compact/shared'
    );
    expect(moduleKey('/x/node_modules/texuli/dist/internal/cx.js', names, '/x')).toBe(
      'texuli/internal/cx'
    );
    expect(moduleKey('/tmp/consumer/src/entry.js', names)).toBe('entry');

    const closure = dependencyClosure(readWorkspace(), PARITY_ROOTS).map((pkg) => pkg.name);
    for (const name of [...PARITY_ROOTS, '@texuli/core', '@texuli/primitives', '@texuli/tokens']) {
      expect(closure).toContain(name);
    }
    expect(closure).not.toContain('@texuli/examples');

    const src = build(100_000, 30_000, ['a (js)', 'b (css)']);
    const within = compareParity(src, build(101_900, 30_590, ['a (js)', 'b (css)']));
    expect(within.ok).toBe(true);
    const grown = compareParity(src, build(100_000, 30_000 * (1 + PARITY_TOLERANCE) + 30));
    expect(grown.ok).toBe(false);
    expect(grown.problems.join('\n')).toMatch(/dist gzip .* over src/);
    const split = compareParity(src, build(100_000, 30_000, ['a (js)', 'b (css)', 'media (js)']));
    expect(split.ok).toBe(false);
    expect(split.problems.join('\n')).toContain('only in dist: media (js)');
    expect(formatParity(src, src, compareParity(src, src))).toContain('OK');
  });
});

describe('dist parity (svelte-package dist vs workspace source, real Vite builds)', () => {
  let out = '';
  afterAll(async () => {
    if (out) await rm(out, { recursive: true, force: true });
  });

  it(`builds the same consumer entry from dist no bigger than from source (within ${PARITY_TOLERANCE * 100} %) and with no extra chunks`, async () => {
    out = await mkdtemp(join(tmpdir(), 'texuli-dist-parity-'));
    const { src, dist, result } = await runParity({ out });
    const report = formatParity(src, dist, result);
    expect(src.files.length, report).toBeGreaterThan(20);
    expect(result.problems, report).toEqual([]);
    expect(result.gzipRatio).toBeLessThanOrEqual(1 + PARITY_TOLERANCE);
    expect(result.rawRatio).toBeLessThanOrEqual(1 + PARITY_TOLERANCE);
    expect(dist.files.length).toBeLessThanOrEqual(src.files.length);
  }, 600_000);
});
