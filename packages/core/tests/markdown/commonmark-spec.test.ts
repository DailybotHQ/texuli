/**
 * The CommonMark 0.31.2 spec suite (652 examples, `fixtures/commonmark-0.31.2.json`, from
 * https://spec.commonmark.org/0.31.2/spec.json) run against `parseMarkdown`, rendered by the
 * test-only reference writer. Known failures are listed by example number with the reason; the
 * runner fails when one of them starts passing (so the list stays honest) or when any other
 * example fails.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMarkdown } from '../../src/markdown/index.ts';
import { specHtml } from './spec-html.ts';

interface SpecExample {
  readonly example: number;
  readonly section: string;
  readonly markdown: string;
  readonly html: string;
}

const examples = JSON.parse(
  readFileSync('packages/core/tests/markdown/fixtures/commonmark-0.31.2.json', 'utf8')
) as SpecExample[];

/** Examples that do not pass yet, with the reason. */
const KNOWN_FAILURES: Readonly<Record<number, string>> = {};

const render = (markdown: string) => specHtml(parseMarkdown(markdown).tree);

describe('CommonMark 0.31.2 spec', () => {
  it('has every example of the suite', () => {
    expect(examples).toHaveLength(652);
  });

  it('passes every example except the listed known failures', () => {
    const failing: number[] = [];
    for (const example of examples)
      if (render(example.markdown) !== example.html) failing.push(example.example);
    const unexpected = failing.filter((n) => !(n in KNOWN_FAILURES));
    const fixed = Object.keys(KNOWN_FAILURES)
      .map(Number)
      .filter((n) => !failing.includes(n));
    expect({ unexpected, fixed }).toEqual({ unexpected: [], fixed: [] });
    expect(examples.length - failing.length).toBe(652 - Object.keys(KNOWN_FAILURES).length);
  });
});

describe.each(examples.map((example) => [example.example, example.section, example] as const))(
  'example %i (%s)',
  (number, _section, example) => {
    it.skipIf(number in KNOWN_FAILURES)('renders the expected HTML', () => {
      expect(render(example.markdown)).toBe(example.html);
    });
  }
);
