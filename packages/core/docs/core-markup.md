# Core markup

`@texuli/core/markup` builds XML and HTML from typed nodes (ADR-016). It is
the shared base of every static output (the `@texuli/document` DOCX writer
today; email and print are planned to move onto it), so escaping happens
in one place, by construction.

```ts
import { el, linkUrl, serializeHtml, serializeXml } from '@texuli/core/markup';

const href = linkUrl(agentLink, 'untrusted'); // null when the URL policy refuses it
serializeHtml(el('p', { class: 'note' }, 'Read ', href ? el('a', { href }, 'the guide') : 'the guide'));
serializeXml(el('w:t', { 'xml:space': 'preserve' }, userText));
```

## Nodes

- `el(name, attributes, ...children)` makes a `MarkupElement`. Attribute
  values (`MarkupAttributeValue`) are strings, finite numbers, booleans or a
  `MarkupUrl`; `null` and `undefined` skip the attribute. Children
  (`MarkupChild`) are nodes, strings and numbers (escaped text), nested
  lists (flattened without recursion), and skipped `null`, `undefined` and
  `false`.
- `text(value)` makes a `MarkupText`. A `MarkupNode` is either;
  `MarkupAttribute` is a stored name and value pair.
- Names are checked when built and again when serialized, so a hand-built
  object cannot smuggle markup through a name.

## URLs

`linkUrl(value, trust)` passes `safeHref` and `imageUrl(value, trust)`
passes `safeImageSrc` from `@texuli/core/url-policy`; the tier is required.
They return a frozen `MarkupUrl`, or `null` when the policy refuses the
value. `isMarkupUrl(value)` is true only for URLs these functions made: a
hand-built `{ kind: 'url' }` object is refused everywhere. In HTML, the
attributes in `HTML_URL_ATTRIBUTES` (`href`, `src`, `srcset`, `action`,
`poster`, `cite`, `xlink:href` and the rest) take only a `MarkupUrl`.

## Serializing

- `serializeXml(root, options)` (`XmlSerializeOptions`): booleans as `1`
  and `0` (the Office convention), childless elements self-closed, the
  UTF-8 declaration first unless `declaration: false`, and an optional
  `allow(name, kind)` allowlist on top of the XML name grammar.
- `serializeHtml(root, options)` (`HtmlSerializeOptions`): only the
  elements in `HTML_ELEMENTS` (no `script`, `style`, frames, objects, forms,
  templates, SVG or MathML), no `on*` handlers, `srcdoc` or `http-equiv`,
  URL attributes only from `MarkupUrl`s, booleans as bare attributes, void
  elements without end tags, and `<!doctype html>` with `doctype: true`.
- `escapeMarkupText` and `escapeMarkupAttribute` escape a value;
  `sanitizeMarkupChars` drops what XML 1.0 cannot carry (C0 controls other
  than tab, newline and carriage return, U+FFFE, U+FFFF, unpaired
  surrogates).

There is no raw-markup API. Serialization is iterative and linear in the
size of the tree; tests cover hostile text and names, forged nodes and URL
objects, a 50,000-level tree and a megabyte of markup characters, and
byte-identical output with the `@texuli/slides` XML writer (until the PPTX
writer moves onto these builders).
