import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * G78: both reduced-motion rules in base.css (the media query and the
 * `[data-tx-motion="reduce"]` toggle) zero CSS durations AND delays with `0s`.
 * A tiny duration (`0.01ms`) still runs a `visibility` transition, so nested
 * content inside a container that turns visible appears one level per frame;
 * a delay left alone holds a reveal back. The browser check is
 * tests/e2e/bugs-75-79.spec.ts.
 */

const baseCss = readFileSync('packages/tokens/src/css/base.css', 'utf8');
const rules = [
  /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n {2}\}/.exec(baseCss)?.[1] ?? '',
  /\[data-tx-motion="reduce"\],[\s\S]*?\{([\s\S]*?)\n {2}\}/.exec(baseCss)?.[1] ?? '',
].map((rule) => rule.replace(/\/\*[\s\S]*?\*\//g, ''));

describe('reduced motion in base.css (G78)', () => {
  it('sets 0s durations and delays for transitions and animations in both rules', () => {
    for (const rule of rules) {
      expect(rule.length).toBeGreaterThan(0);
      for (const property of [
        'transition-duration',
        'transition-delay',
        'animation-duration',
        'animation-delay',
      ]) {
        expect(rule, property).toContain(`${property}: 0s !important;`);
      }
    }
  });

  it('never uses a non-zero duration or delay under reduced motion', () => {
    for (const rule of rules) {
      const times = [...rule.matchAll(/(?:duration|delay):\s*([^;]+);/g)].map((match) =>
        (match[1] ?? '').replace(' !important', '').trim()
      );
      expect(times.length).toBeGreaterThan(0);
      expect(times.filter((value) => !/^0(?:s|ms)$/.test(value))).toEqual([]);
    }
  });
});
