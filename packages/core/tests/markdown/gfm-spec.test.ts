/**
 * The GFM 0.29 suites from cmark-gfm 0.29.0.gfm.13, run against `parseMarkdown` and the
 * test-only reference writer (cmark-gfm's HTML shape):
 * - `fixtures/gfm-0.29-spec.json`: the 672 examples of the GFM spec (`test/spec.txt`). Like
 *   cmark-gfm's own runner, each example runs with only the extension its tag names (`table`,
 *   `strikethrough`, `autolink`, `tagfilter`, `disabled` for task lists); untagged examples are
 *   CommonMark 0.29 and run with `gfm: false`.
 * - `fixtures/gfm-0.29-extensions.json`: the 30 examples of `test/extensions.txt`, run with every
 *   extension on (the default), as cmark-gfm runs them.
 * The tag filter and the nested `<strong>` rule are cmark-gfm renderer rules, applied by the
 * test writer; raw HTML never renders in Texuli.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type GfmOptions, parseMarkdown } from '../../src/markdown/index.ts';
import { specHtml } from './spec-html.ts';

interface GfmExample {
  readonly example: number;
  readonly section: string;
  readonly extension: string;
  readonly markdown: string;
  readonly html: string;
}

const load = (file: string) =>
  JSON.parse(readFileSync(`packages/core/tests/markdown/fixtures/${file}`, 'utf8')) as GfmExample[];

const spec = load('gfm-0.29-spec.json');
const extensions = load('gfm-0.29-extensions.json');

function specOptions(tag: string): { gfm: false | GfmOptions } {
  if (tag === '' || tag === 'tagfilter') return { gfm: false };
  return {
    gfm: {
      table: tag === 'table',
      strikethrough: tag === 'strikethrough',
      autolink: tag === 'autolink',
      taskList: tag === 'disabled',
      footnote: false,
    },
  };
}

const renderSpec = (example: GfmExample) =>
  specHtml(parseMarkdown(example.markdown, specOptions(example.extension)).tree, {
    checkbox: 'spec',
    tagFilter: example.extension === 'tagfilter',
    flatStrong: true,
  });

const renderExtension = (example: GfmExample) =>
  specHtml(parseMarkdown(example.markdown).tree, {
    checkbox: 'cmark',
    tagFilter: true,
    flatStrong: true,
  });

describe('GFM 0.29 spec (cmark-gfm test/spec.txt)', () => {
  it('passes all 672 examples', () => {
    expect(spec).toHaveLength(672);
    const failing = spec.filter((example) => renderSpec(example) !== example.html);
    expect(failing.map((example) => example.example)).toEqual([]);
  });

  it.each(
    spec
      .filter((example) => example.extension !== '')
      .map((example) => [example.example, example.extension, example] as const)
  )('extension example %i (%s)', (_number, _tag, example) => {
    expect(renderSpec(example)).toBe(example.html);
  });
});

describe('GFM 0.29 extensions (cmark-gfm test/extensions.txt)', () => {
  it.each(extensions.map((example) => [example.example, example.section, example] as const))(
    'example %i (%s)',
    (_number, _section, example) => {
      // Example 20 only checks that nothing crashes (`<IGNORE>`).
      if (example.html.startsWith('<IGNORE>')) {
        expect(parseMarkdown(example.markdown).tree.type).toBe('root');
        return;
      }
      expect(renderExtension(example)).toBe(example.html);
    }
  );
});
