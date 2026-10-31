// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  compileDesignSystem,
  resolveDesignSystem,
} from '../../packages/tokens/src/design-system/compile.ts';

declare const process: { env: Record<string, string | undefined> };

/*
 * The design-system compiler is called on every switch a host recomputes
 * (Protoyard recompiles on persona or scenario changes), so it must stay a
 * small fraction of a frame budget. Bound: compiling the acme fixture (every
 * section, its texuli:violet base already resolved) for light and dark in
 * 25 ms, best of three after a warm-up, scaled by the machine baseline like
 * the other perf files. Measured locally on an Apple silicon laptop: about
 * 4 ms per compile (2026-10-30).
 */

function bestOfThree(work: () => unknown): number {
  work();
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 3; i++) {
    const started = performance.now();
    work();
    best = Math.min(best, performance.now() - started);
  }
  return best;
}

let state = 2166136261;
const random = () => {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state / 0x1_0000_0000;
};
const baselineMs = bestOfThree(() => Float64Array.from({ length: 100_000 }, random).sort());
const budget = (floorMs: number, factor: number) => Math.max(floorMs, factor * baselineMs);
const report = (name: string, ms: number) => {
  if (process.env.TEXULI_PERF_REPORT === '1') {
    console.log(`[perf] ${name}: ${ms.toFixed(3)} ms (baseline ${baselineMs.toFixed(1)} ms)`);
  }
};

describe('design-system compile time', () => {
  it('compiles acme for two modes within 25 ms', async () => {
    const acme = JSON.parse(
      readFileSync(
        new URL('../../packages/spec/fixtures/design-systems/acme.json', import.meta.url),
        'utf8'
      )
    );
    const resolved = await resolveDesignSystem(acme, { trust: 'developer' });
    if (!resolved.ok) throw new Error(JSON.stringify(resolved.errors));
    let ok = false;
    const ms = bestOfThree(() => {
      const compiled = compileDesignSystem(resolved.document, {
        trust: 'developer',
        modes: ['light', 'dark'],
      });
      ok = compiled.ok;
    });
    report('compile acme (light + dark)', ms);
    expect(ok).toBe(true);
    expect(ms).toBeLessThan(budget(25, 1.5));
  });
});
