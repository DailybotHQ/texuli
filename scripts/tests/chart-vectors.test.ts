/**
 * The chart vectors generator (PLAN_013, ADR-025): the committed vectors
 * equal what the web functions produce today, every case is plain JSON, and
 * the cases cover the shared core and every ported family.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildVectors, renderVectors, VECTORS_PATH } from '../chart-vectors.ts';

const ROOT = resolve(import.meta.dirname, '../..');

describe('chart vectors', () => {
  const cases = buildVectors();

  it('keeps the committed vectors equal to the web functions', () => {
    expect(readFileSync(resolve(ROOT, VECTORS_PATH), 'utf8')).toBe(renderVectors(cases, ROOT));
  });

  it('writes plain JSON cases: no NaN or infinities hidden as null outputs', () => {
    for (const item of cases) {
      expect(typeof item.fn).toBe('string');
      expect(JSON.parse(JSON.stringify(item))).toEqual(item);
      expect(item.output, `${item.fn} ${JSON.stringify(item.input)}`).not.toBeUndefined();
    }
  });

  it('covers the shared core and the cartesian layout', () => {
    const names = new Set(cases.map((item) => item.fn));
    for (const fn of [
      'jsNumber',
      'ticks',
      'niceDomain',
      'linearScale',
      'bandScale',
      'stack',
      'linePath',
      'areaPath',
      'timeTicks',
      'formatNumber',
      'formatCompact',
      'formatTimeTick',
      'createCartesianLayout',
    ])
      expect(names.has(fn), fn).toBe(true);
  });
});
