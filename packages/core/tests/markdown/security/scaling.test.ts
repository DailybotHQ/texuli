/**
 * Linear time per reader: for each pathological family, doubling the input must less than triple
 * the time (generous: a quadratic reader quadruples it). Best of three runs per size in thread CPU
 * time (not wall-clock, so parallel test files do not skew it), plus a small
 * absolute slack so sub-millisecond timings do not flake. Every family is also held to an absolute
 * ceiling at 64 KB.
 */
import { describe, expect, it } from 'vitest';
import { htmlToMarkdownTree } from '../../../src/html/index.ts';
import { parseMarkdown } from '../../../src/markdown/index.ts';
import { MARKDOWN_DIALECTS, readMarkdownDialect } from '../../../src/markdown-dialects/index.ts';
import { markdownTreeToHtml } from '../../../src/markdown-html/index.ts';
import { bestTime } from './check.ts';

const SIZE = 32 * 1024;
const SLACK_MS = 15;
const CEILING_MS = 1500;

/** Units repeated to the size: delimiter runs, unclosed openers, nesting and entity soup. */
const FAMILIES: Record<string, string> = {
  'open brackets': '[',
  'link openers': '[a](',
  'image openers': '![',
  'unclosed links': '[x](a',
  'emphasis runs': '*a_',
  'strong openers': '**a',
  'backtick runs': '`a``',
  'angle brackets': '<a ',
  'mention openers': '<@',
  broadcasts: '<!',
  autolinks: '<http',
  spoilers: '||',
  strikes: '~~a',
  entities: '&#x',
  backslashes: '\\',
  'quote nesting': '> ',
  'list nesting': '- ',
  'html tags': '<b>',
  'html comments': '<!--',
  cells: '|a',
  lines: 'a\n',
};

const readers: Record<string, (source: string) => unknown> = {
  commonmark: (source) => parseMarkdown(source),
  html: (source) => htmlToMarkdownTree(source),
  ...Object.fromEntries(
    MARKDOWN_DIALECTS.map((dialect) => [
      dialect,
      (source: string) => readMarkdownDialect(source, dialect),
    ])
  ),
};

const sized = (unit: string, bytes: number) => unit.repeat(Math.ceil(bytes / unit.length));

/**
 * Time `run` on the small and the large input; retry up to three times, since a parallel test file
 * or a collection can stall one measurement. A quadratic reader fails every attempt.
 */
function scales(run: (input: 'small' | 'large') => unknown, slack: number): string | undefined {
  let last = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    run('small');
    const t1 = bestTime(() => run('small'), 3);
    const t2 = bestTime(() => run('large'), 3);
    if (t2 <= 3 * t1 + slack && t2 <= CEILING_MS) return undefined;
    last = `${t1.toFixed(1)} ms → ${t2.toFixed(1)} ms`;
  }
  return last;
}

describe('readers scale linearly', () => {
  for (const [name, read] of Object.entries(readers)) {
    it(`${name}: ${Object.keys(FAMILIES).length} families, 32 KB → 64 KB`, () => {
      const slow: string[] = [];
      for (const [family, unit] of Object.entries(FAMILIES)) {
        const inputs = { small: sized(unit, SIZE), large: sized(unit, SIZE * 2) };
        const result = scales((which) => read(inputs[which]), SLACK_MS);
        if (result) slow.push(`${family}: ${result}`);
      }
      expect(slow).toEqual([]);
    }, 60_000);
  }
});

describe('the HTML writer scales linearly', () => {
  it('on wide and on nested trees', () => {
    const slow: string[] = [];
    const families = {
      paragraphs: 'a *b* [c](https://example.com)\n\n',
      quotes: '> ',
      items: '- x\n',
    };
    for (const [family, unit] of Object.entries(families)) {
      const trees = {
        small: parseMarkdown(sized(unit, SIZE)).tree,
        large: parseMarkdown(sized(unit, SIZE * 2)).tree,
      };
      // The writer allocates many small objects, so collections weigh more: a wider slack
      // (measured alone: 11 → 22 ms for paragraphs).
      const result = scales((which) => markdownTreeToHtml(trees[which]), 4 * SLACK_MS);
      if (result) slow.push(`${family}: ${result}`);
    }
    expect(slow).toEqual([]);
  }, 60_000);
});
