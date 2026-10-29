# `@texuli/document/schema`

The document validator, written with the `@texuli/deck/schema` kit
(ADR-011): the same schema data drives validation, the JSON Schema export
and the types.

> **Status: in development.** On npm from `0.7.0`, the package's first
> release (pre-1.0).

## Validating

```ts
import { loadUntrustedDocument, validateDocument } from '@texuli/document/schema';

const result = validateDocument(value); // untrusted tier by default
if (result.ok) render(result.document);
else for (const issue of result.issues) console.log(issue.code, issue.jsonPath, issue.message);

const fromText = loadUntrustedDocument(jsonText, { maxBytes: 1_000_000 });
```

- `validateDocument(input, options)` returns a `DocumentValidation`: every
  issue at once and a fresh copy when valid, never a throw.
  `ValidateDocumentOptions` sets `trust` (`untrusted` by default, or
  `developer`) and `maxIssues`.
- `isDocument(input, options)` is the boolean form.
- `loadUntrustedDocument(input, options)` takes JSON text or data; text is
  size-checked against `maxBytes` (`LoadDocumentOptions`, default 4,000,000)
  before `JSON.parse`.
- `documentSchema(trust)` is the schema value for a tier (built once per
  tier); `documentJsonSchema()` is its JSON Schema 2020-12 export (untrusted
  tier). Refinements are described in the `description` fields, since JSON
  Schema cannot express them.
- `jsonBytes(value, cap)` counts the UTF-8 bytes of a value's JSON (the
  inline payload cap uses it).

## What is checked

- Structure and closed vocabularies: the format and version, every block
  type, mark, tone, embed kind, block family and page size; unknown keys and
  prototype keys are refused.
- Text safety: controls, line separators and bidi overrides or isolates are
  refused in runs and titles; code text may hold tabs and newlines.
- Caps: depth, node count, characters, runs, payload bytes (see
  `DOCUMENT_LIMITS` in the model).
- Unique ids across blocks, columns and list items; list items start with a
  paragraph; columns hold two to four columns.
- The URL policy at the tier: link hrefs pass `safeHref`, media refs pass
  `safeImageSrc` (from `@texuli/core/url-policy`).
- Embeds hold exactly one of `ref` and `inline`; an inline component is one
  catalog node (`{ id, props }`, no children); an inline deck passes
  `parseDeck` from `@texuli/deck/model`.
- Comment anchors that name no node, or fall outside their block's text,
  are kept as orphaned threads and reported as warnings.

`@texuli/blocks` props, catalog component props, sheets and canvases are
bounded here and validated again by their own validators when the editor
paints them (two-phase validation, ADR-011).

## Diagnostics

`DocumentDiagnostic` is the deck engine's diagnostic shape: `code`,
`severity`, `path`, `jsonPath`, RFC 6901 `pointer`, `message` and `fix`.
Besides the schema kit's codes (`invalid-type`, `required`, `unknown-key`,
`too-long`, `too-many`, `too-deep`, `unsafe-text`, `unsafe-key` and
others), `DOCUMENT_CODES` lists the document's own (`DocumentCode`):

| Code | Meaning |
| --- | --- |
| `unsupported-format`, `unsupported-version` | Not a version 1 Texuli document |
| `unknown-block`, `unknown-mark` | A type outside the closed vocabulary |
| `duplicate-mark`, `duplicate-id` | A mark type twice on one run; an id used twice |
| `too-many-blocks`, `too-much-text` | Over the document caps |
| `unsafe-url` | Refused by the URL policy at the tier |
| `list-item-start` | A list item that does not start with a paragraph |
| `embed-source` | An embed without exactly one of `ref` and `inline` |
| `payload-too-large` | An inline payload or props over 64 KiB |
| `invalid-component`, `invalid-deck` | An inline component or deck that is malformed |
| `unknown-anchor`, `anchor-range` | Orphaned comment anchors (warnings) |
| `invalid-input` | The loader could not read the input |
| `page-size` | A `custom` page without both `width` and `height`, or a preset size with them |
