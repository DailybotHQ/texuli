/**
 * G110: `@texuli/tokens/system.css` ships the system token defaults alone, so
 * a host with its own reset gets sized controls without the reset, the motion
 * tables or the focus ring hook of `base.css`. Component CSS reads these
 * tokens with no fallback, so a missing one renders a control with no size
 * (the 0.9.0 report: 10 E2E failures at the first consumer).
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cssOf, stylesheetFiles } from '../../../scripts/check-token-usage.ts';
import { renderSystemCss } from '../scripts/render.ts';
import { BASE_SYSTEM_TOKEN_NAMES, DATA_VIZ_TOKEN_NAMES } from '../src/system/index.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const TOKENS = join(ROOT, 'packages/tokens');
const read = (path: string) => readFileSync(join(TOKENS, path), 'utf8');

/** `--name: value` declarations of a stylesheet, name to value. */
function declarations(css: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of css.matchAll(/(--tx-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    map.set(match[1] as string, (match[2] as string).trim());
  }
  return map;
}

describe('@texuli/tokens/system.css (G110)', () => {
  const systemCss = read('src/css/system.css');
  const system = declarations(systemCss);

  it('is exported as a stylesheet subpath and matches the generator', () => {
    const manifest = JSON.parse(read('package.json')) as {
      exports: Record<string, unknown>;
      sideEffects: string[];
    };
    expect(manifest.exports['./system.css']).toEqual({
      types: './src/css/styles.ts',
      default: './src/css/system.css',
    });
    expect(manifest.sideEffects).toContain('**/*.css');
    expect(systemCss).toBe(renderSystemCss());
  });

  it('declares every base system token on every token scope, inside tx.base', () => {
    expect([...system.keys()]).toEqual([...BASE_SYSTEM_TOKEN_NAMES]);
    expect(systemCss).toContain('@layer tx.base, tx.components;');
    expect(systemCss).toContain(':where(:root, [data-tx-theme], [data-tx-scope]) {');
    for (const name of DATA_VIZ_TOKEN_NAMES) expect(system.has(name), name).toBe(false);
  });

  it('declares every system token that component CSS reads', () => {
    const base = new Set(BASE_SYSTEM_TOKEN_NAMES);
    const read = new Set<string>();
    for (const file of stylesheetFiles(ROOT)) {
      const css = cssOf(file, readFileSync(join(ROOT, file), 'utf8'));
      for (const match of css.matchAll(/var\(\s*(--tx-[a-z0-9-]+)/g)) {
        const name = match[1] as string;
        if (base.has(name)) read.add(name);
      }
    }
    // The scan sees real reads (space, size and shape at least).
    expect(read.size).toBeGreaterThan(20);
    for (const name of ['--tx-space-unit', '--tx-size-icon-sm', '--tx-shape-radius-md']) {
      expect(read.has(name), name).toBe(true);
    }
    for (const name of read) expect(system.has(name), name).toBe(true);
  });

  it('carries no reset, motion table or focus ring hook', () => {
    expect(systemCss).not.toMatch(/\bbody\s*\{|box-sizing|--tx-motion-|focus-ring-style|@media/);
  });

  it('base.css declares a superset of system.css, with the same values', () => {
    const base = declarations(read('src/css/base.css'));
    for (const [name, value] of system) expect(base.get(name), name).toBe(value);
  });
});
