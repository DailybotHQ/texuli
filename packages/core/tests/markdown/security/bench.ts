/**
 * Throughput benchmark for the Markdown stack (not a test; nothing asserts). Run:
 *
 *     pnpm exec tsx packages/core/tests/markdown/security/bench.ts
 *
 * Prints MB/s per reader and writer on a realistic mixed document (~256 KB) and on the worst
 * pathological family found by `scaling.test.ts`. Numbers depend on the machine; docs/SECURITY.md
 * records one run.
 */
import { htmlToMarkdownTree } from '../../../src/html/index.ts';
import { parseMarkdown } from '../../../src/markdown/index.ts';
import {
  MARKDOWN_DIALECTS,
  readMarkdownDialect,
  writeMarkdownDialect,
} from '../../../src/markdown-dialects/index.ts';
import { markdownTreeToHtml } from '../../../src/markdown-html/index.ts';
import { bestTime } from './check.ts';

const SECTION = `# Release notes

Texuli **0.17** adds _locked_ design systems, ~~old~~ new [docs](https://example.com/docs) and \`code\`.

- [x] Parser
- [ ] Writer with a [link](https://example.com/a?b=1)
  1. nested *item*

> A quote with **bold** and a footnote[^1].

| a | b |
| - | -: |
| 1 | 2 |

\`\`\`ts
const answer = 42 < 43;
\`\`\`

[^1]: The note.

`;

const markdown = SECTION.repeat(Math.ceil((256 * 1024) / SECTION.length));
const tree = parseMarkdown(markdown).tree;
const html = markdownTreeToHtml(tree).html;
const mb = (bytes: number, ms: number) => (bytes / 1024 / 1024 / (ms / 1000)).toFixed(1);

const rows: [string, number, number][] = [];
const run = (name: string, bytes: number, fn: () => unknown) => {
  fn();
  rows.push([name, bytes, bestTime(fn, 5)]);
};

run('parseMarkdown (CommonMark + GFM)', markdown.length, () => parseMarkdown(markdown));
run('markdownTreeToHtml', html.length, () => markdownTreeToHtml(tree));
run('htmlToMarkdownTree', html.length, () => htmlToMarkdownTree(html));
for (const dialect of MARKDOWN_DIALECTS) {
  const written = writeMarkdownDialect(tree, dialect).value;
  run(`write ${dialect}`, written.length, () => writeMarkdownDialect(tree, dialect));
  run(`read ${dialect}`, written.length, () => readMarkdownDialect(written, dialect));
}
const bomb = '[a]('.repeat(64 * 1024);
run('parseMarkdown, 256 KB of "[a]("', bomb.length, () => parseMarkdown(bomb));
const tags = '<b><i>'.repeat(40 * 1024);
run('htmlToMarkdownTree, 240 KB of "<b><i>"', tags.length, () => htmlToMarkdownTree(tags));

for (const [name, bytes, ms] of rows)
  console.log(
    `${name.padEnd(42)} ${(bytes / 1024).toFixed(0).padStart(5)} KB ${ms.toFixed(1).padStart(8)} ms ${mb(bytes, ms).padStart(7)} MB/s`
  );
