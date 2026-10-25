import { describe, expect, it } from 'vitest';
import manifest from '../package.json' with { type: 'json' };
import * as charts from '../src/index.ts';
import * as color from '../src/math/color.ts';
import * as downsample from '../src/math/downsample/index.ts';
import * as math from '../src/math/index.ts';
import * as layout from '../src/math/layout/index.ts';
import * as scales from '../src/math/scales/index.ts';
import * as shapes from '../src/math/shapes/index.ts';

/*
 * `@texuli/charts/math` is split into family subpaths so each one carries its
 * own size budget; the facade keeps every existing import working.
 */

const exportsMap = manifest.exports as Record<string, { types: string; default: string }>;
/** The source each subpath must point at: the modules imported above. */
const targets: Record<string, string> = {
  './math/scales': './src/math/scales/index.ts',
  './math/shapes': './src/math/shapes/index.ts',
  './math/layout': './src/math/layout/index.ts',
  './math/downsample': './src/math/downsample/index.ts',
  './math/color': './src/math/color.ts',
};

const families = {
  './math/scales': scales,
  './math/shapes': shapes,
  './math/layout': layout,
  './math/downsample': downsample,
  './math/color': color,
} as const;

describe('math family subpaths', () => {
  it('declares every family subpath with types and a default pointing at source', () => {
    for (const [subpath, module] of Object.entries(families)) {
      const target = exportsMap[subpath];
      expect(target, subpath).toBeDefined();
      expect(target?.types).toBe(target?.default);
      expect(target?.default).toBe(targets[subpath]);
      expect(Object.keys(module).length).toBeGreaterThan(0);
    }
  });

  it('keeps the facade an exact union of the family subpaths', () => {
    const union = new Map<string, unknown>();
    for (const module of Object.values(families)) {
      for (const [name, value] of Object.entries(module)) {
        expect(union.has(name), `${name} is exported by two families`).toBe(false);
        union.set(name, value);
      }
    }
    expect(Object.keys(math).sort()).toEqual([...union.keys()].sort());
    // Same bindings, not copies: tree-shaking and instanceof checks keep working.
    for (const [name, value] of union) expect((math as Record<string, unknown>)[name]).toBe(value);
  });

  it('keeps the package root re-exporting the math facade', () => {
    for (const name of Object.keys(math)) {
      expect((charts as Record<string, unknown>)[name], name).toBe(
        (math as Record<string, unknown>)[name]
      );
    }
  });
});
