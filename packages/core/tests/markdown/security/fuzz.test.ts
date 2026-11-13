/**
 * Seeded property tests (no dependency: `rng` in check.ts is mulberry32). For every reader and
 * writer of the Markdown stack, on generated hostile input:
 * - nothing throws;
 * - the calls stay within a time per KB in aggregate (one call only below a catastrophic ceiling);
 * - HTML output, re-tokenized, holds only allowlisted elements and attributes, and every URL
 *   passes the policy at the tier used; dialect output carries no live link to a refused URL;
 * - every tree stays within the depth limits.
 * A failure prints the seed; rerun one case with `FUZZ_SEED=<seed>`.
 */
import { describe, expect, it } from 'vitest';
import { htmlToMarkdownTree } from '../../../src/html/index.ts';
import {
  MARKDOWN_LIMITS,
  type MdBlock,
  type MdInline,
  type MdRoot,
} from '../../../src/markdown/ast.ts';
import { parseMarkdown } from '../../../src/markdown/index.ts';
import {
  MARKDOWN_DIALECTS,
  readMarkdownDialect,
  writeMarkdownDialect,
} from '../../../src/markdown-dialects/index.ts';
import { markdownTreeToHtml } from '../../../src/markdown-html/index.ts';
import { cpuMs, dialectProblems, htmlProblems, rng, treeDepth } from './check.ts';
import { HOSTILE_URLS } from './corpus.ts';

const CASES = Number(process.env.FUZZ_CASES ?? 120);
/** Room for slow machines and larger FUZZ_CASES runs; the per-call budgets do the real checking. */
const TIMEOUT = 30_000 + CASES * 200;
const ONLY_SEED = process.env.FUZZ_SEED === undefined ? undefined : Number(process.env.FUZZ_SEED);
/**
 * Time budgets, in this thread's CPU time. A single call may pause for garbage collection, so one call is held only to a
 * catastrophic ceiling; the real bound is the aggregate: every reader and writer call in a test,
 * summed, within `MS_PER_KB` of the bytes processed (measured about 1 ms per KB on a laptop).
 */
const CALL_CEILING_MS = (bytes: number) => 1000 + (100 * bytes) / 1024;
const MS_PER_KB = 25;
const clock = { ms: 0, bytes: 0 };
/** Readers flatten past the limits, so no tree is deeper than the sum plus its fixed wrappers. */
const MAX_TREE_DEPTH = MARKDOWN_LIMITS.blockDepth * 2 + MARKDOWN_LIMITS.inlineDepth + 8;

const PIECES = [
  // Markdown and dialect syntax
  '*',
  '**',
  '_',
  '__',
  '~',
  '~~',
  '`',
  '```',
  '||',
  '[',
  ']',
  '(',
  ')',
  '![',
  '](',
  '[^',
  ']:',
  '\\',
  '#',
  '# ',
  '> ',
  '- ',
  '* ',
  '1. ',
  '- [ ] ',
  '- [x] ',
  '|',
  '---',
  '\n',
  '\n\n',
  '    ',
  '\t',
  ' ',
  '<',
  '>',
  '<@',
  '<#',
  '<!',
  '<@&',
  '@everyone',
  '@here',
  '@channel',
  '<at>',
  '</at>',
  '<users/1>',
  '<!everyone>',
  '<@U1>',
  '<#C1|x>',
  '<https://example.com|x>',
  // HTML
  '<p>',
  '</p>',
  '<b>',
  '</b>',
  '<i>',
  '<a href="',
  '">',
  '</a>',
  '<img src=',
  ' onerror=alert(1)',
  '<script>',
  '</script>',
  '<style>',
  '<svg>',
  '<math>',
  '<mglyph>',
  '<!--',
  '-->',
  '<![CDATA[',
  ']]>',
  '<table>',
  '<tr>',
  '<td>',
  '<pre>',
  '<code>',
  '<ul>',
  '<li>',
  '<tg-spoiler>',
  '<span class="tg-spoiler">',
  '<noscript>',
  '<xmp>',
  '<textarea>',
  '<plaintext>',
  '"',
  "'",
  '=',
  '&',
  '&amp;',
  '&lt;',
  '&#',
  '&#x',
  '&colon;',
  '&Tab;',
  ';',
  'x',
  'word',
  'tg://user?id=1',
  // Unicode
  '\u200b',
  '\u202e',
  '\u0000',
  '\ufeff',
  'é',
  '日本',
  '🙂',
  '\ud83d',
  ...HOSTILE_URLS,
] as const;

function generate(next: () => number, maxLength: number): string {
  const parts: string[] = [];
  let length = 0;
  const target = Math.floor(next() * maxLength);
  while (length < target) {
    const piece = PIECES[Math.floor(next() * PIECES.length)] as string;
    parts.push(piece);
    length += piece.length;
  }
  return parts.join('');
}

/** A random tree for the writers: every node type, hostile strings in every field. */
function generateTree(next: () => number): MdRoot {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T;
  const str = () => generate(next, 40);
  let budget = 400;
  const inline = (depth: number): MdInline => {
    budget -= 1;
    const leaf = depth > 6 || budget <= 0;
    const kind = leaf
      ? pick([
          'text',
          'inlineCode',
          'break',
          'image',
          'mention',
          'footnoteReference',
          'html',
        ] as const)
      : pick([
          'text',
          'emphasis',
          'strong',
          'delete',
          'underline',
          'spoiler',
          'link',
          'image',
          'mention',
          'html',
        ] as const);
    const kids = () => Array.from({ length: 1 + Math.floor(next() * 3) }, () => inline(depth + 1));
    switch (kind) {
      case 'text':
        return { type: 'text', value: str() };
      case 'inlineCode':
        return { type: 'inlineCode', value: str() };
      case 'break':
        return { type: 'break' };
      case 'image':
        return { type: 'image', url: pick(HOSTILE_URLS), alt: str(), title: str() };
      case 'mention':
        return {
          type: 'mention',
          kind: pick(['user', 'channel', 'role', 'everyone', 'here'] as const),
          id: next() < 0.5 ? 'U1' : str(),
          label: str(),
        };
      case 'footnoteReference':
        return { type: 'footnoteReference', label: str() };
      case 'html':
        return { type: 'html', value: str() };
      case 'link':
        return {
          type: 'link',
          url: next() < 0.6 ? pick(HOSTILE_URLS) : 'https://example.com/ok',
          title: str(),
          children: kids(),
        };
      default:
        return { type: kind, children: kids() } as MdInline;
    }
  };
  const block = (depth: number): MdBlock => {
    budget -= 1;
    const leaf = depth > 4 || budget <= 0;
    const kind = leaf
      ? pick(['paragraph', 'heading', 'code', 'html', 'thematicBreak', 'definition'] as const)
      : pick([
          'paragraph',
          'heading',
          'blockquote',
          'list',
          'code',
          'table',
          'footnoteDefinition',
        ] as const);
    const inlines = () => Array.from({ length: 1 + Math.floor(next() * 4) }, () => inline(0));
    const blocks = () => Array.from({ length: 1 + Math.floor(next() * 3) }, () => block(depth + 1));
    switch (kind) {
      case 'paragraph':
        return { type: 'paragraph', children: inlines() };
      case 'heading':
        return { type: 'heading', depth: pick([1, 2, 3, 4, 5, 6] as const), children: inlines() };
      case 'code':
        return { type: 'code', lang: str(), meta: str(), value: str(), fenced: next() < 0.5 };
      case 'html':
        return { type: 'html', value: str() };
      case 'thematicBreak':
        return { type: 'thematicBreak' };
      case 'definition':
        return { type: 'definition', label: str(), url: pick(HOSTILE_URLS) };
      case 'blockquote':
        return { type: 'blockquote', children: blocks() };
      case 'footnoteDefinition':
        return { type: 'footnoteDefinition', label: str(), children: blocks() };
      case 'list':
        return {
          type: 'list',
          ordered: next() < 0.5,
          start: Math.floor(next() * 100),
          spread: next() < 0.5,
          children: Array.from({ length: 1 + Math.floor(next() * 3) }, () =>
            next() < 0.5
              ? { type: 'listItem' as const, spread: false, children: blocks() }
              : {
                  type: 'listItem' as const,
                  spread: false,
                  checked: next() < 0.5,
                  children: blocks(),
                }
          ),
        };
      default:
        return {
          type: 'table',
          align: [pick(['left', 'center', 'right', null] as const)],
          children: Array.from({ length: 1 + Math.floor(next() * 3) }, () => ({
            type: 'tableRow' as const,
            children: Array.from({ length: 1 + Math.floor(next() * 3) }, () => ({
              type: 'tableCell' as const,
              children: inlines(),
            })),
          })),
        };
    }
  };
  return {
    type: 'root',
    version: 'texuli-md/v1',
    children: Array.from({ length: 1 + Math.floor(next() * 5) }, () => block(0)),
  };
}

/** Run one call: below the catastrophic ceiling, and counted toward the aggregate budget. */
function timed<T>(label: string, bytes: number, fn: () => T): T {
  const started = cpuMs();
  const value = fn();
  const ms = cpuMs() - started;
  clock.ms += ms;
  clock.bytes += bytes;
  if (ms > CALL_CEILING_MS(bytes)) throw new Error(`${label}: ${ms.toFixed(1)} ms for ${bytes} B`);
  return value;
}

/** Reset the aggregate clock, run `body`, and hold the total to `MS_PER_KB`. */
function withinBudget(body: () => void): void {
  clock.ms = 0;
  clock.bytes = 0;
  body();
  const perKb = clock.ms / Math.max(1, clock.bytes / 1024);
  expect(perKb, `${clock.ms.toFixed(0)} ms for ${(clock.bytes / 1024).toFixed(0)} KB`).toBeLessThan(
    MS_PER_KB
  );
}

/** Every writer on one tree; returns the problems found. */
function writeAll(tree: MdRoot, label: string): string[] {
  const problems: string[] = [];
  const size = JSON.stringify(tree).length;
  for (const trust of ['untrusted', 'developer'] as const) {
    const html = timed(
      `${label} html/${trust}`,
      size,
      () => markdownTreeToHtml(tree, { trust }).html
    );
    for (const problem of htmlProblems(html, trust))
      problems.push(`${label} html/${trust}: ${problem}`);
    for (const dialect of MARKDOWN_DIALECTS) {
      const out = timed(
        `${label} ${dialect}/${trust}`,
        size,
        () => writeMarkdownDialect(tree, dialect, { trust }).value
      );
      for (const problem of dialectProblems(out, dialect, trust))
        problems.push(`${label} ${dialect}/${trust}: ${problem}`);
    }
  }
  return problems;
}

const readers: readonly [string, (source: string) => MdRoot][] = [
  ['commonmark', (source) => parseMarkdown(source).tree],
  ['html', (source) => htmlToMarkdownTree(source).tree],
  ...MARKDOWN_DIALECTS.map(
    (dialect) =>
      [`dialect ${dialect}`, (source: string) => readMarkdownDialect(source, dialect).tree] as [
        string,
        (source: string) => MdRoot,
      ]
  ),
];

const seeds = (base: number) =>
  ONLY_SEED !== undefined ? [ONLY_SEED] : Array.from({ length: CASES }, (_, i) => base + i);

describe('fuzz: readers', () => {
  readers.forEach(([name, read], index) => {
    it(
      `${name}: ${CASES} seeded inputs`,
      () => {
        const problems: string[] = [];
        withinBudget(() => {
          for (const seed of seeds(1000 * (index + 1))) {
            const next = rng(seed);
            const source = generate(next, 2048);
            const label = `${name} seed ${seed}`;
            const tree = timed(label, source.length, () => read(source));
            expect(treeDepth(tree), label).toBeLessThanOrEqual(MAX_TREE_DEPTH);
            problems.push(...writeAll(tree, label));
          }
        });
        expect(problems).toEqual([]);
      },
      TIMEOUT
    );
  });
});

describe('fuzz: writers on generated trees', () => {
  it(
    `${CASES * 2} seeded trees through every writer`,
    () => {
      const problems: string[] = [];
      withinBudget(() => {
        for (const seed of seeds(90_000)) {
          for (const offset of [0, 50_000]) {
            problems.push(
              ...writeAll(generateTree(rng(seed + offset)), `tree seed ${seed + offset}`)
            );
          }
        }
      });
      expect(problems).toEqual([]);
    },
    TIMEOUT
  );
});

describe('fuzz: round trip through HTML', () => {
  it(
    'HTML written from any tree reads back and writes the same HTML',
    () => {
      for (const seed of seeds(70_000)) {
        const once = markdownTreeToHtml(generateTree(rng(seed))).html;
        const back = htmlToMarkdownTree(once).tree;
        const twice = markdownTreeToHtml(back).html;
        // Idempotence after one normalization: the second pass changes nothing.
        expect(markdownTreeToHtml(htmlToMarkdownTree(twice).tree).html, `seed ${seed}`).toBe(twice);
      }
    },
    TIMEOUT
  );
});
