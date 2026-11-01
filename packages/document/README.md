# @texuli/document

The framework-free, DOM-free document engine for
[Texuli](https://texuli.com), an MIT-licensed Svelte 5 component library by
Dailybot, Inc. (*Small pieces. Infinite possibilities.*). It holds the block
document format with persisted ids, the validator, typed operations with
exact inverses, bounded RFC 6902 patches, an op log with undo, Markdown
import and export, the pagination engine, owned DOCX and PDF writers, and
the CRDT sync core. It has no Svelte and no DOM: Node tools, agents and the
`@texuli/pages` editor all use the same engine.

> **Status: in development (pre-1.0).** `@texuli/document` is published on
> npm as `0.11.4`, with provenance (first published as `0.7.0`; built in PLAN_010,
> ADR-010 and ADR-011 in
> [DECISIONS](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)).
> Under 0.x a new minor (`0.12.0`) may contain breaking changes, so pin the
> exact version or use `^0.11.0`, which accepts only 0.11.x
> (see [RELEASE](https://github.com/DailybotHQ/texuli/blob/main/docs/RELEASE.md)).

It sits on layer L1: it imports `@texuli/core` (the editor text model, the
Markdown codec and the URL policy) and `@texuli/deck` (the schema kit and
deck validation) downward, and nothing else.

## Install

```bash
npm install @texuli/document
```

In the Texuli workspace, depend on it as
`"@texuli/document": "workspace:*"`. It has no peer dependencies and no
third-party runtime dependencies; `@texuli/core` and `@texuli/deck` come
with it.

## Quick start

```ts
import { createDocument, paragraphBlock } from '@texuli/document/model';
import { loadUntrustedDocument } from '@texuli/document/schema';
import { applyOperations } from '@texuli/document/ops';
import { documentToMarkdown } from '@texuli/document/markdown';

const doc = createDocument({
  meta: { title: 'Release notes' },
  blocks: [paragraphBlock('p1', 'Shipped the new editor.')],
});

const edit = applyOperations(doc, [
  { op: 'insert-text', id: 'p1', offset: 0, text: 'Today: ' },
  { op: 'set-mark', id: 'p1', from: 0, to: 5, mark: { type: 'strong' }, value: true },
]);
if (edit.ok) {
  console.log(documentToMarkdown(edit.document)); // **Today**: Shipped the new editor.
  const undo = applyOperations(edit.document, edit.inverse); // back to `doc`
}

// Documents from an agent, a file or a share link: validated at the untrusted tier.
const checked = loadUntrustedDocument(jsonText);
```

Every entry point is total: it never throws on hostile input, does bounded
work, and returns either a fresh valid value or diagnostics (a code, a
JSON path, an RFC 6901 pointer, a message and a fix).

## Subpaths

| Subpath | What it holds | Docs |
| --- | --- | --- |
| `.` | `model`, `schema`, `ops` and `markdown` together (not `sync` or `collab`) | this page |
| `model` | The format and its types, the closed vocabularies and caps, constructors and iterative read helpers | [model](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/model.md) |
| `schema` | The validator on the `@texuli/deck` schema kit, the URL policy for links and media, embedded decks, the untrusted loader and the JSON Schema export | [schema](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/schema.md) |
| `schema-core` | The same validator without the deck model: inline decks refused unless the host passes `validateDeck` (from `0.11.3`) | [schema-core](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/schema-core.md) |
| `ops` | Typed operations by persisted id with exact inverses, bounded RFC 6902 patches with inverse patches, and the op log with undo and redo | [ops](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/ops.md) |
| `ops-core` | The same operations, patches and op log validated without the deck model: inline decks refused unless the host passes `validateDeck` (from `0.11.5`) | [ops-core](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/ops-core.md) |
| `markdown` | Markdown import and export through the linear-time core editor codec | [markdown](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/markdown.md) |
| `paged` | The pagination engine: page sizes and margins in points, explicit breaks, headings kept with what follows, widow and orphan control, headers and footers with page fields, over a measurer the caller injects | [paged](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/paged.md) |
| `docx` | The owned DOCX (WordprocessingML) writer on the escaped `@texuli/core/markup` builders and `@texuli/core/zip` (lazy) | [docx](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/docx.md) |
| `pdf` | The owned PDF 1.7 writer over the paged layout: standard 14 fonts, an optional host TrueType font, link annotations through the URL policy, JPEG and PNG images (lazy) | [pdf](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/pdf.md) |
| `sync` | The CRDT core: a Fugue sequence, a move-safe tree, last-writer-wins registers, selective undo, presence and the `SyncAdapter` transports (lazy) | [sync](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/sync.md) |
| `collab` | Documents on the CRDT: a `DocumentSync` session (the id-keyed tree diff from an editor's op log to replica operations and back), comments anchored to item ids, suggestions, named versions with restore, and presence (lazy) | [collab](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/collab.md) |

## The format

```text
{ format: "texuli-document", formatVersion: 1, meta, page?, blocks, annotations? }
```

- **Text blocks** are the `@texuli/core` editor vocabulary: paragraph,
  heading (levels 1 to 4), code, list (bullet, ordered, todo), quote,
  divider and media, with text runs and the `strong`, `em`, `strike`,
  `code` and `link` marks.
- **Document blocks** add `callout`, `toggle`, `columns` (two to four
  `column`s), `page-link` (a nested page is its own document, resolved by
  the host), `block` (a wrapped `@texuli/blocks` block: `family`, `block`,
  `props`) and `embed` (a catalog `component`, a `deck`, a `sheet` or a
  `canvas`, inline up to 64 KiB or by host `ref`).
- **Annotations** hold comment threads apart from content; Markdown export
  drops them.
- **Caps:** 2,000 blocks (columns and list items included), 200,000
  characters, 8 levels of nesting, 64-character ids.

## Security

- No HTML in or out. Markdown keeps raw tags as literal text.
- Every link passes `safeHref` and every media ref passes `safeImageSrc`
  from `@texuli/core/url-policy`, at the `untrusted` tier by default.
- Payloads that belong to higher layers (`@texuli/blocks` props, catalog
  components, sheets, canvases) are bounded here and validated again by
  their own validators when they are painted (two-phase validation).
- Hostile input stays linear: the loader caps bytes before parsing, the
  validator caps depth, nodes and issues, Markdown is read in one pass, and
  sync validates every remote batch before it integrates.
- Sync is not authorization: the host decides who may write.
- Static outputs are sink-free by construction: DOCX parts are built from
  the escaped `@texuli/core/markup` nodes (no string templates), and the PDF
  writer writes every string as a hex string, with no JavaScript, forms or
  embedded files. Links in files pass `safeHref` at the `untrusted` tier by
  default and must be absolute (`https:` or `mailto:`); image refs pass
  `safeImageSrc` before the host is asked for their bytes.

## Learn more

- [Model](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/model.md)
- [Schema](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/schema.md)
- [Schema core](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/schema-core.md)
- [Ops core](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/ops-core.md)
- [Operations, patches and the op log](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/ops.md)
- [Markdown](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/markdown.md)
- [Paged layout](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/paged.md),
  [DOCX](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/docx.md) and
  [PDF](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/pdf.md)
- [Sync](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/sync.md)
- [Collaboration: comments, suggestions, versions and presence](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/collab.md)
- Decisions: ADR-010 (sync), ADR-011 (document packages) and ADR-016 (static outputs) in
  [DECISIONS](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)
- Source: [github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli)
  · Issues: [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues)

## Contributing

Contributions are welcome; start at the
[GitHub repository](https://github.com/DailybotHQ/texuli).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-document).
