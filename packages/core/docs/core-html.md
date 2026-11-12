# Core html

> **Status: in development.** Added in PLAN_023 (ADR-034); not yet in a
> published release.

`@texuli/core/html` reads untrusted HTML into a `texuli-md/v1` Markdown
tree. A DOM-free linear tokenizer feeds a tolerant tree builder. Nothing is
parsed by a browser, inserted into a DOM or evaluated: the result is plain
data, which a writer such as [core-markdown-html](core-markdown-html.md)
then renders safely.

```ts
import { htmlToMarkdownTree } from '@texuli/core/html';

const { tree, diagnostics } = htmlToMarkdownTree(pastedHtml, { trust: 'untrusted' });
```

## Exports

- `htmlToMarkdownTree(html, options)` returns `{ tree, diagnostics }` and
  never throws. `HtmlReadOptions` sets the URL `trust` tier, `maxSource`
  and the `idPrefix` footnote ids carry.
- `HTML_MAX_ELEMENT_DEPTH`: the tree builder's element depth cap.
- `decodeHtmlEntities(text)`: named and numeric character references.
- `DiagnosticList` and `MAX_DIAGNOSTICS_PER_CODE`: the bounded diagnostic
  collector shared with `core/markdown-html`.

## Loss rules

- Dropped with their content (`html-dropped`): `script`, `style`, `iframe`,
  `svg`, `math`, `template`, `textarea`, form controls, media and other
  raw-text or embedded elements. Comments and doctypes are skipped.
- Elements outside the mapping are transparent (text kept, tag dropped).
  Every attribute outside the mapping, including event handlers, `style`,
  ids and classes, is removed.
- Refused URLs keep their text (`url-refused`), including schemes hidden
  behind entities, whitespace or control characters.
- Whitespace collapses as a browser renders it, except inside `pre`.
- Nesting past the AST limits is flattened to text (`depth-limit`).
