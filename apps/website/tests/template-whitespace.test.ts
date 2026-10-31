// @vitest-environment node
/**
 * No lost spaces in the site's `.astro` templates (PLAN_011 Final Review):
 * Astro drops a line break between text and an inline element or an
 * expression instead of turning it into a space ("the210 library themes",
 * "families:text"). The scanner is in ./template-whitespace.ts.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findLostSpaces } from './template-whitespace.ts';

const SRC = join(import.meta.dirname, '..', 'src');

function astroFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return astroFiles(path);
    return entry.name.endsWith('.astro') ? [path] : [];
  });
}

const sides = (source: string) => findLostSpaces(source).map(({ line, side }) => `${line}:${side}`);

describe('lost spaces in .astro templates', () => {
  it('finds a line break between text and an inline element or expression, either side', () => {
    const cases: [string, string[]][] = [
      ['<p>Every one of the\n  <strong>{n}</strong> themes</p>', ['1:before']],
      ['<p>A <code>messages</code>\n  override any text.</p>', ['1:after']],
      ['<p>Block families:\n  {families.join(", ")}. Sizes</p>', ['1:before']],
      ['<p>Release <code>{v}</code>. {policy}\n  ships</p>', ['1:after']],
      // A break between words, or inside the element, is a space as usual.
      ['<p>Every one\n  of the <strong>{n}</strong> themes</p>', []],
      ['<p>See <a href="/x">\n  the guide</a>.</p>', []],
      // Punctuation that hugs its neighbor is meant to join.
      ['<p>A stable code (\n  {codes}).</p>', []],
      ['<p>Read <code>x</code>\n  .</p>', []],
      // `{' '}`, comments, block elements and self-closing tags are not text neighbors.
      ["<p>Every command:\n  {' '}\n  <a href='/ops'>ops</a>.</p>", []],
      ['<div>Intro\n  <section>Body</section></div>', []],
      ['<p>Line one\n  <br />line two</p>', []],
      ['<p>Text\n  {/* note */}</p>', []],
    ];
    for (const [source, expected] of cases) expect(sides(source), source).toEqual(expected);
  });

  it('skips the frontmatter, scripts, styles, comments and attribute values', () => {
    const source = [
      '---',
      "const a = 'x';",
      'const b = { c: 1 }',
      '---',
      '<a href={href}',
      '  class="link">Docs</a>',
      '<script>const s = `the`;',
      '  <code>x</code></script>',
      '<style>.a { color: red }',
      '  b { color: blue }</style>',
      '<!-- the',
      '  <code>x</code> -->',
      '<p title="a > b">Fine on one line <code>x</code> here.</p>',
    ].join('\n');
    expect(sides(source)).toEqual([]);
  });

  it('every .astro file of the site keeps its spaces', () => {
    const files = astroFiles(SRC);
    expect(files.length).toBeGreaterThan(100);
    const found = files.flatMap((file) =>
      findLostSpaces(readFileSync(file, 'utf8')).map(
        ({ line, side }) => `${relative(SRC, file)}:${line} (${side} an inline element)`
      )
    );
    expect(found, 'Move a word across the line break so it falls between two words').toEqual([]);
  });
});
