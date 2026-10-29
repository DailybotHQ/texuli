# @texuli/document

The framework-free, DOM-free document engine for
[Texuli](https://texuli.com), an MIT-licensed Svelte 5 component library by
Dailybot, Inc. (*Small pieces. Infinite possibilities.*). It holds the block
document format with persisted ids, the validator, typed operations with
exact inverses, bounded RFC 6902 patches, an op log with undo, Markdown
import and export, and the CRDT sync core. It has no Svelte and no DOM:
Node tools, agents and the planned `@texuli/pages` editor all use the same
engine.

> **Status: in development (pre-1.0).** `@texuli/document` is not on npm
> yet. It is built in PLAN_010 and its first release is planned for `0.7.0`
> (ADR-010 and ADR-011 in
> [DECISIONS](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)).
> Its version is the `0.0.0` placeholder until then. Under 0.x a new minor
> may contain breaking changes
> (see [RELEASE](https://github.com/DailybotHQ/texuli/blob/main/docs/RELEASE.md)).

It sits on layer L1: it imports `@texuli/core` (the editor text model, the
Markdown codec and the URL policy) and `@texuli/deck` (the schema kit and
deck validation) downward, and nothing else.

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
| `.` | `model`, `schema`, `ops` and `markdown` together (not `sync`) | this page |
| `model` | The format and its types, the closed vocabularies and caps, constructors and iterative read helpers | [model](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/model.md) |
| `schema` | The validator on the `@texuli/deck` schema kit, the URL policy for links and media, embedded decks, the untrusted loader and the JSON Schema export | [schema](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/schema.md) |
| `ops` | Typed operations by persisted id with exact inverses, bounded RFC 6902 patches with inverse patches, and the op log with undo and redo | [ops](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/ops.md) |
| `markdown` | Markdown import and export through the linear-time core editor codec | [markdown](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/markdown.md) |
| `sync` | The CRDT core: a Fugue sequence, a move-safe tree, last-writer-wins registers, selective undo, presence and the `SyncAdapter` transports (lazy) | [sync](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/sync.md) |

Planned, not built yet (ADR-011, ADR-016): `paged` (the pagination engine)
is planned, `docx` (the DOCX writer) is planned, and `pdf` (the PDF writer)
is planned. They are not in the package exports until they land.

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

## Learn more

- [Model](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/model.md)
- [Schema](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/schema.md)
- [Operations, patches and the op log](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/ops.md)
- [Markdown](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/markdown.md)
- [Sync](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/sync.md)
- Decisions: ADR-010 (sync) and ADR-011 (document packages) in
  [DECISIONS](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)
- Source: [github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli)
  · Issues: [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues)

## Contributing

Contributions are welcome; start at the
[GitHub repository](https://github.com/DailybotHQ/texuli).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-document).
