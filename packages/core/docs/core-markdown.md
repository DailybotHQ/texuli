# Core markdown

> **Status: in development.** Added in PLAN_023 (ADR-034); not yet in a
> published release.

`@texuli/core/markdown` holds the `texuli-md/v1` Markdown tree that every
Texuli Markdown and HTML reader and writer shares, a CommonMark 0.31.2
parser into it with the GitHub Flavored Markdown 0.29 extensions, and a
Markdown writer back out of it. It is framework-free and DOM-free. The
parser never throws on input, runs in time linear in the source, and
enforces `MARKDOWN_LIMITS`. Text in the tree is plain text: raw HTML stays
in `html` nodes as literal source, and URLs are kept as written for the
writers to pass through the URL policy
([core-markdown-html](core-markdown-html.md) renders a tree as safe HTML;
[core-html](core-html.md) reads HTML into a tree).

```ts
import { parseMarkdown, writeMarkdown } from '@texuli/core/markdown';

const { tree, diagnostics } = parseMarkdown(agentReply);
const markdown = writeMarkdown(tree);
```

## Exports

- `parseMarkdown(source, options)` returns `{ tree, diagnostics }`.
  `MarkdownParseOptions`:
  - `limits`: lower the limits; a value above `MARKDOWN_LIMITS` is clamped
    to it;
  - `gfm`: the GFM extensions, on by default. `false` reads strict
    CommonMark; an object turns single extensions off, for example
    `{ footnote: false }`.
- `writeMarkdown(tree, options)` returns Markdown text. It never throws: a
  value that is not a tree writes `''`. `MarkdownWriteOptions` sets the
  `bullet` (`-` by default).
- The tree types (`MdRoot`, `MdBlock`, `MdInline`…), `MARKDOWN_AST_VERSION`,
  `MARKDOWN_LIMITS` and the diagnostic types.
- `gfmFlags(option)` and `GFM_OFF`: the resolved extension set.

## What the parser reads

| Construct | Tree |
| --- | --- |
| CommonMark 0.31.2 blocks and inlines | `paragraph`, `heading`, `thematicBreak`, `blockquote`, `list`/`listItem`, `code`, `html`, `definition`; `text`, `emphasis`, `strong`, `inlineCode`, `break`, `link`, `image`, `html` |
| GFM tables | `table` (with `align`), `tableRow`, `tableCell` |
| GFM task list items | `listItem.checked` |
| GFM strikethrough (`~a~`, `~~a~~`) | `delete` |
| GFM extended autolinks (`www.`, `http://`, `https://`, `ftp://`, email, `mailto:`, `xmpp:`) | `link` |
| GFM footnotes | `footnoteReference`, `footnoteDefinition` |

- Soft line breaks are `\n` in text.
- Link reference definitions are kept as `definition` nodes; links store
  the URL they resolved to.
- `code.value` has no final line ending, and the info string is split into
  `lang` and `meta`.
- An escaped or referenced character never joins an extended autolink, so
  `www\.example.com` stays text.
- The GFM tag filter is not an extension here: raw HTML never renders as
  markup.

## Limits

| Limit | What happens | Diagnostic |
| --- | --- | --- |
| `source` (1,000,000 UTF-16 units) | The rest is dropped, never splitting a surrogate pair | `source-truncated` |
| `blockDepth` (32) | Deeper block quotes, lists and footnote definitions stay text | `depth-limit` |
| `inlineDepth` (16) | Deeper emphasis, links and strikethrough are flattened into their text | `depth-limit` |
| `nodes` (200,000) | The tree stops growing | `node-limit` |

Pathological shapes (nested brackets, long emphasis and tilde runs, deep
block quotes and lists, unclosed HTML, autolink candidates, wide and tall
tables) are tested for linear time.

## What the writer keeps

- Reading the output back gives the same tree. This is measured on every
  spec example: 651 of 652 for CommonMark, 671 of 672 for the GFM spec and
  30 of 30 for the cmark-gfm extensions. The one exception is an indented
  code block whose lines start with a space, directly after a bullet list:
  it is written fenced, because no bullet indent can keep it outside the
  list.
- Text is escaped so it never becomes markup: punctuation that could open
  a construct, line starts that could open a block, and autolink triggers.
  Leading and trailing spaces become character references.
- Raw `html` nodes are written as their literal source, as they were in
  Markdown.
- `underline`, `spoiler` and `mention` have no CommonMark form: their text
  is kept. The chat dialect writers keep them.

## Conformance

The spec suites run in `packages/core/tests/markdown`:

| Suite | Pass |
| --- | --- |
| CommonMark 0.31.2 (`gfm: false`) | 652 of 652 |
| CommonMark 0.31.2 with GFM on | 648 of 652; the 4 others are extended autolinks GFM adds on purpose |
| GFM 0.29 spec (cmark-gfm `test/spec.txt`, each example with its own extension) | 672 of 672 |
| cmark-gfm `test/extensions.txt` (every extension on) | 30 of 30 |
