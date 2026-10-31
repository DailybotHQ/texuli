# `@texuli/document/markdown`

Markdown import and export through the `@texuli/core` editor codec
(ADR-003): the same closed Markdown subset, read in one linear pass. No HTML
in or out: raw tags stay literal text, links pass `safeHref` and images
pass `safeImageSrc` at the tier.

> **Status: in development.** On npm from `0.7.0`, the package's first
> release (pre-1.0).

```ts
import { documentFromMarkdown, documentToMarkdown } from '@texuli/document/markdown';

const read = documentFromMarkdown('# Launch plan\n\nShip **today**.');
if (read.ok) console.log(read.document.meta.title); // Launch plan
const markdown = documentToMarkdown(read.document);
```

## Import

`documentFromMarkdown(source, options)` returns a `MarkdownImport`: a
validated document with persisted ids and the codec's degradation
diagnostics (refused links, capped nesting, stripped characters), each
reported once. It never throws. `MarkdownImportOptions`:

- `trust`: the URL tier (`untrusted` by default);
- `newId`: the id source (default `b1`, `b2`, …);
- `meta`: metadata for the new document; the title defaults to the first
  heading's text;
- `maxSource`: the longest source read (the codec's 100,000 characters by
  default).

An image refused by the URL policy becomes a paragraph of its alt text.

## Export

`documentToMarkdown(doc, options)` writes the closed subset, plus GFM
tables for wrapped data tables. Core blocks (paragraph, heading, code,
list, quote, divider, media) read back as the same blocks. Document-only
blocks have no Markdown spelling and degrade:

| Block | Written as |
| --- | --- |
| `callout` | a quote, its title in bold first |
| `toggle` | its summary as a paragraph, then its blocks |
| `columns` | each column's blocks in order |
| `page-link`, `embed` | the title as a paragraph (or left out with `embeds: 'drop'`) |
| `block`, a data `table` | a GFM table, its caption in emphasis on the line before (or left out with `blocks: 'drop'`) |
| `block`, any other | the text the DOCX and PDF writers print for it: its `title`, `label`, `value`, `text`, `caption` and `description` joined with ` · `, or `[<block>]` (or left out with `blocks: 'drop'`) |

`MarkdownExportOptions`: `title` writes `meta.title` as a level 1 heading
first; `embeds` is `title` (default) or `drop`; `blocks` is `text`
(default) or `drop`. Annotations are never written.

> **New in `0.10.0`** (Protoyard gap G112): the
> `0.9.0` writer leaves every wrapped block out.

A wrapped table is read like the DOCX and PDF writers read it
(`wrappedTable`: `{ caption?, columns: [{ id, label }], rows: [{ [id]: cell }] }`,
at most 16 columns and 500 rows; string, number and boolean cells). Each
cell is written on one line (line breaks become spaces) with `|` and the
Markdown punctuation (`` \ ` * _ [ ] ~ < > ! & ``) escaped, so no cell
becomes markup, HTML or a new column. A table inside a quote, a callout or
a list item keeps that block's prefix on every line.

Wrapped blocks do not round-trip: the closed subset has no table and no
wrapped block, so `documentFromMarkdown` reads a written table back as a
paragraph of its escaped cells, and any other wrapped block as a paragraph
of its text.

## Design system front matter

> **New in `0.10.0`.**

A document's `designSystem` ([model](model.md),
[ADR-024](../../../docs/DECISIONS.md#adr-024-design-systems-on-every-surface))
is written as a closed front matter block before the content, and read
back from it, losslessly:

```markdown
---
designSystem: acme@2.1.0
---

# Launch plan
```

- A `ref` is written as itself (`acme@2.1.0`, `texuli:violet`); an inline
  document is written as the whole field in one line of JSON
  (`designSystem: {"inline":{…}}`; its strings hold no line break).
- Only that exact shape is front matter: `---`, one `designSystem:` line,
  `---`. Any other leading `---` stays Markdown (a divider), and a value
  starting with `{` that is not JSON leaves the source as it is.
- What is read is validated like any document field: a range, a URL or
  both keys is refused with an issue under `$.designSystem`. The design
  system's own rules run where it is compiled (the reader).
- A document without a design system is written with no front matter, as
  before.
