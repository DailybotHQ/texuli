// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkFacts, checkText, type Facts, HISTORICAL } from '../check-facts.ts';

const FACTS: Facts = {
  primitives: 42,
  themesFull: 210,
  themesCore: 64,
  publishedPackages: 26,
  release: '0.12.0',
};

const claims = (text: string) => checkText('doc.md', text, FACTS).map((issue) => issue.claim);

describe('checkText', () => {
  it('flags a typed count that disagrees with the repository', () => {
    expect(claims('The library ships 41 owned headless primitives.')).toEqual([
      '41 owned headless primitives',
    ]);
    expect(claims('Browse 200 themes, or 63 themes in the core library.')).toEqual([
      '200 themes',
      '63 themes',
    ]);
    expect(claims('All 25 published packages and the 27 packable packages.')).toEqual([
      '25 published packages',
      '27 packable packages',
    ]);
    expect(claims('released on npm, every one at `0.11.5`')).toEqual(['every one at `0.11.5`']);
  });

  it('accepts the real counts, lower bounds and unrelated numbers', () => {
    expect(
      claims(
        '42 primitives, 210 themes (64 themes in the library), 200+ themes to browse, 26 published packages, every one at `0.12.0`. Svelte 5 primitives; 16 packages then.'
      )
    ).toEqual([]);
    expect(claims('Over 300+ themes.')).toEqual(['300+ themes']);
  });

  it('skips a line marked as historical', () => {
    expect(claims('0.1 had 41 primitives <!-- facts: historical -->')).toEqual([]);
  });

  it('reports the file and line', () => {
    expect(checkText('a.md', 'one\n41 primitives', FACTS)).toEqual([
      { file: 'a.md', line: 2, claim: '41 primitives', expected: '42 primitives' },
    ]);
  });
});

describe('the repository', () => {
  it('keeps history files out of the scan', () => {
    for (const file of ['docs/RELEASE.md', 'docs/quality/csp.md', 'skills/texuli/CHANGELOG.md'])
      expect(
        HISTORICAL.some((pattern) => pattern.test(file)),
        file
      ).toBe(true);
  });

  it('has no typed count that disagrees with its source', async () => {
    const { facts, issues } = await checkFacts();
    expect(facts.primitives).toBeGreaterThan(40);
    expect(facts.themesFull).toBeGreaterThan(facts.themesCore);
    expect(issues).toEqual([]);
  });
});
