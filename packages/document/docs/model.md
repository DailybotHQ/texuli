# `@texuli/document/model`

The document format (version 1, ADR-011) and its types, the closed
vocabularies and caps, constructors and read helpers. Framework-free and
DOM-free; every walk is iterative, so a deep tree never overflows the
stack.

> **Status: in development.** On npm from `0.7.0`, the package's first
> release (pre-1.0).

## The document

`TexuliDocument` is plain JSON:

```ts
{
  format: 'texuli-document',   // DOCUMENT_FORMAT
  formatVersion: 1,            // DOCUMENT_FORMAT_VERSION
  meta: { title: 'Field notes', locale: 'en' },
  page: { size: 'a4', orientation: 'portrait' },   // optional
  blocks: [ /* DocumentBlock[] */ ],
  annotations: { comments: [ /* CommentThread[] */ ] },  // optional
  designSystem: { ref: 'acme@2.1.0' },                   // optional, spec 0.10.0
}
```

`DOCUMENT_FORMAT` is `texuli-document` and `DOCUMENT_FORMAT_VERSION` is
`1`. The value types used across the blocks: `DocumentHeadingLevel` (1–4),
`DocumentListKind`, `CalloutTone`, `EmbedKind`, `BlockFamily` and
`DocumentJsonObject` (a bounded JSON object).

- `DocumentMeta`: `title`, and optional `description`, `locale` (BCP 47),
  `dir`, `authors`, `tags`, `created` and `updated` (ISO 8601).
- `PageSettings`: a `PageSize` (`PAGE_SIZES`: `a4`, `a5`, `letter`,
  `legal`, `custom`), an orientation, the `width` and `height` of a
  `custom` page (50 to 1,000 mm), optional margins in millimetres (`top`,
  `bottom`, `inlineStart`, `inlineEnd`), a `header` and a `footer` (each a
  `PageBand`: `start`, `center` and `end` text where `{page}`, `{pages}`
  and `{title}` are replaced), and `breaks`, the ids of the top-level
  blocks that start a new page (explicit page breaks; unknown ids are
  ignored). The paged view, print and the DOCX and PDF writers use them
  (`@texuli/document/paged`, `docx` and `pdf`).
- `DocumentAnnotations`: `CommentThread`s, each with a `CommentAnchor` (a
  block id, optionally a UTF-16 range of its text), a quoted text, a status
  and `CommentMessage`s. A thread whose block is gone is kept as orphaned.
- `DocumentDesignSystem` (from spec 0.10.0, new in `0.10.0`): the design system the document follows, exactly one of
  `ref` (an exact `id@x.y.z` the host resolves, or `texuli:<theme>`; the
  grammar is `DESIGN_SYSTEM_REF_PATTERN` from `@texuli/document/schema`, the same as the blueprint's
  `$defs.designSystemReference`) and `inline` (a whole
  `texuli/design-system` document). `@texuli/document/schema` checks the
  shape, the ref grammar and bounded, single-line JSON (depth 16, no
  control or bidi characters); the design-system rules themselves run in
  the reader (`@texuli/pages/reader`), which validates and compiles the
  document before it applies it. The Markdown writer carries it in front
  matter, losslessly ([markdown.md](markdown.md#design-system-front-matter)),
  and the DOCX and PDF writers apply it as `design` values the caller
  compiles, reporting `design-system-unapplied` when none are given
  ([pdf.md](pdf.md#design-systems)).

## Blocks

`DocumentBlock` is the union of every block a block list holds
(`DOCUMENT_BLOCK_TYPES`); `DocumentBlockType` is its `type`. Every node has
a persisted `DocumentBlockId` (`DOCUMENT_ID_PATTERN`, at most 64
characters, unique in the document). `DocumentNode` is any node with an id:
a block, a `ColumnBlock` or a `ListItem`.

The core editor vocabulary (ADR-003), with its runs and marks:

| Type | Shape |
| --- | --- |
| `ParagraphBlock` | `content: DocumentInline[]` |
| `HeadingBlock` | `level: DocumentHeadingLevel` (1–4), `content` |
| `CodeBlock` | `lang?` (`LANG_PATTERN`), `text` |
| `ListBlock` | `kind: DocumentListKind` (`bullet`, `ordered`, `todo`), `start?`, `items: ListItem[]` (each `checked?` and `blocks`, starting with a paragraph) |
| `QuoteBlock` | `blocks` |
| `DividerBlock` | — |
| `MediaBlock` | `ref` (an HTTPS URL or a relative asset path), `alt` |

`DocumentInline` is a text run (`DocumentText`: `text` and `marks`) or a
line break. `DocumentMark` is one of `strong`, `em`, `strike`, `code` and
`link` (`DocumentMarkType`). `DocumentTextBlock` is a block a caret can be
in.

Document blocks:

| Type | Shape |
| --- | --- |
| `CalloutBlock` | `tone: CalloutTone` (`CALLOUT_TONES`), `title?`, `blocks` |
| `ToggleBlock` | `summary: DocumentInline[]`, `open?`, `blocks` |
| `ColumnsBlock` | `columns`: two to four `ColumnBlock`s (`width?` of 12, `blocks`) |
| `PageLinkBlock` | `ref` (a host ref, `DOCUMENT_REF_PATTERN`), `title` |
| `WrappedBlock` | `family: BlockFamily` (`BLOCK_FAMILIES`), `block` (a `@texuli/blocks` type, `BLOCK_TYPE_PATTERN`), `props: DocumentJsonObject` |
| `EmbedBlock` | `kind: EmbedKind` (`EMBED_KINDS`: `component`, `deck`, `sheet`, `canvas`), exactly one of `ref` and `inline`, `title?` |

An inline `component` embed is a `ComponentPayload`: one catalog node, a
kebab-case id (`COMPONENT_ID_PATTERN`) and optional props. An inline `deck`
is deck model v2. `DocumentJson` is the bounded JSON these payloads hold.
`CONTAINER_TYPES` lists the block types whose children are a block list.

`BLOCK_FAMILIES` mirrors `@texuli/blocks` (L5, which this L1 engine cannot
import); a test keeps the two equal.

## Caps

`DOCUMENT_LIMITS`: 2,000 nodes, 200,000 characters, 8 levels of nesting,
64-character ids, 2,048-character hrefs, 2,000 runs per text block, 500
characters in titles and alt text, 64 KiB inline payloads, 500 comment
threads of up to 200 messages, and 4,000,000 bytes read by the untrusted
loader.

## Helpers

- `createDocument({ meta, blocks })` and `paragraphBlock(id, text)` build
  documents.
- `createIdSource(prefix)` makes deterministic ids (`b1`, `b2`, …);
  `freshIdSource(doc)` skips ids the document already uses. Both return a
  `DocumentIdSource`.
- `walkDocument(doc, visit)` visits every node in document order with a
  `DocumentVisit` (node, parent id, index, depth); return `false` to skip a
  node's children. `childKey` and `childrenOf` read a node's children.
- `findNode(doc, id)` returns a `DocumentLocation` (node, parent, index,
  depth) or `null`; `collectIds` and `countNodes` list and count nodes.
- `inlinePlainText`, `ownText` and `documentPlainText` read text.
- `collectRefs(doc)` lists every `DocumentRef` the host resolves (nested
  pages and embeds by `ref`).
