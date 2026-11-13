# Core markdown-html

> **Status: in development.** Added in PLAN_023 (ADR-034); not yet in a
> published release.

`@texuli/core/markdown-html` writes a `texuli-md/v1` Markdown tree as a
safe HTML fragment. Every element is built with `el` from
[`@texuli/core/markup`](core-markup.md) and written by `serializeHtml`, so
there is no raw-markup path: text and attributes are escaped, and every
`href` and `src` passes the URL policy at the caller's tier.

```ts
import { markdownTreeToHtml } from '@texuli/core/markdown-html';

const { html, diagnostics } = markdownTreeToHtml(tree, { trust: 'untrusted' });
```

## Exports

- `markdownTreeToHtml(tree, options)` returns `{ html, diagnostics }`.
- `markdownTreeToMarkup(tree, options)` returns the `core/markup` nodes, for
  hosts that compose them further.
- `MARKDOWN_HTML_MAX_DEPTH`: the deepest nesting written as elements.
- `footnoteIdPart(label)`: the id fragment a footnote label becomes.

Options (`MarkdownHtmlOptions`): `trust` (default `untrusted`), `rawHtml`
(`drop`, the default, or `escape`), `idPrefix` (default `user-content-`)
and `linkRel` (default `nofollow noopener noreferrer` when untrusted).

## Loss rules

- Raw `html` nodes are never emitted as markup: dropped (`html-dropped`) or
  written as escaped text.
- A refused link keeps its text (`url-refused`); a refused image becomes its
  `alt` text.
- Definitions are not rendered; footnotes move to one closing
  `<section data-footnotes>`.
- Every id starts with `idPrefix`, so content cannot clobber page ids.
- Past the depth limit, text is kept as plain text (`depth-limit`); past the
  node limit, the rest is left out (`node-limit`). The writer never throws.

The output reads back to the same tree through [core-html](core-html.md).
