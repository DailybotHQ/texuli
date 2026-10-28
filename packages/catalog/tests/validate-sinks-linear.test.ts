import { describe, expect, it } from 'vitest';
import { scanSinks } from '../src/validate/sinks.ts';

const fastest = (run: () => void): number => {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 3; i += 1) {
    const start = performance.now();
    run();
    best = Math.min(best, performance.now() - start);
  }
  return best;
};

describe('scanSinks HTML string check', () => {
  it('still flags tags with spaces around the slash', () => {
    for (const value of ['<b>x</b>', '< / b>', '<  /  div class="x">', '<img src=x>']) {
      expect(scanSinks({ props: { text: value } }).map((f) => f.message)).toContain(
        'an HTML string'
      );
    }
    for (const value of ['a < b', '<>', '< / 1>', 'x <- y']) {
      expect(scanSinks({ props: { text: value } }).map((f) => f.message)).not.toContain(
        'an HTML string'
      );
    }
  });

  it('stays linear on uncapped strings of spaces after an angle bracket', () => {
    for (const value of [`<${' '.repeat(16_000)}`, `<${' '.repeat(8_000)}/${' '.repeat(8_000)}`]) {
      expect(fastest(() => scanSinks({ props: { text: value } }))).toBeLessThan(20);
    }
  });
});
