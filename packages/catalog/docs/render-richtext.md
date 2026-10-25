# Catalog rich-text renderer

**Package:** `@texuli/catalog`  
**Import:** `@texuli/catalog/render/richtext`  
**Tests:** `packages/catalog/tests/render-richtext.test.ts`

## Goal

Parse an untrusted **inline Markdown subset** into **sink-free nodes**. Hosts map
`RichTextInline` trees to real components or plain text. Nothing produces HTML
strings, DOM nodes, or `{@html}` payloads.

## Supported subset

| Marker | Node |
| --- | --- |
| plain text | `{ type: 'text', value }` |
| `**strong**` | `{ type: 'strong', children }` |
| `*em*` | `{ type: 'em', children }` |
| `` `code` `` | `{ type: 'code', value }` |
| `[label](href)` | `{ type: 'link', href?, children }` |
| hard break (`  \n` or `\\\n`) | `{ type: 'break' }` |
| blank line | new paragraph |

Backslash escapes (`\*`, `` \` ``, `\[`, …) keep the next character literal.
Raw HTML-like tags stay as `text` with an `html-as-text` diagnostic.

## Safety

- Link `href` values pass through `@texuli/core/url-policy` `safeHref`.
- Default trust tier is `untrusted` (agent/catalog content). Pass
  `hrefTrust: 'developer'` only for developer-authored chrome.
- Rejected URLs drop the link node and keep the label as text
  (`link-rejected` diagnostic). The rejected URL never appears in the tree.
- Caps (see `RICHTEXT_LIMITS`): source 4000 chars, inline depth 6, 256
  paragraphs. Over-limit input degrades with diagnostics; it never throws or
  recurses without a bound.

## Usage

```ts
import {
  renderRichText,
  richTextToPlain,
  type RichTextInline,
} from '@texuli/catalog/render/richtext';

const { document, diagnostics } = renderRichText(
  'See **docs** at [guide](https://example.com).'
);

// Host maps nodes — never stringifies to HTML.
function renderInline(nodes: readonly RichTextInline[]): string {
  return richTextToPlain({ paragraphs: [{ type: 'paragraph', children: nodes }] });
}

void diagnostics;
void renderInline;
```

## Public API

| Export | Role |
| --- | --- |
| `renderRichText(source, options?)` | Parse → `{ document, diagnostics }` |
| `richTextToPlain(document)` | Flatten for search, titles, plain fallbacks |
| `RICHTEXT_LIMITS` | Frozen caps |
| `RichTextInline` / `RichTextDocument` / `RichTextResult` | Node types |

## Honest limits

- Block-level Markdown (lists, headings, fenced code, tables) is out of scope;
  use `@texuli/blocks` document surfaces when those exist.
- Emphasis uses CommonMark-style single/double asterisks only (no `_` underscore
  forms in this subset).
- Nested depth beyond the cap leaves remaining markers as literal text.
- The subpath is measured against the `@texuli/catalog/*` entry (default
  per-subpath cap) in `texuli.budgets.json`.
