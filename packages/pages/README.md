# @texuli/pages

The block document editor and reader for
[Texuli](https://texuli.com), an MIT-licensed Svelte 5 component library by
Dailybot, Inc. (*Small pieces. Infinite possibilities.*). It edits
`@texuli/document` documents: text through `@texuli/editor`, a slash menu of
every block type, block selection and drag on `@texuli/drag` with keyboard
equivalents, nested pages, resizable columns, and live embeds of catalog
components and decks painted by `@texuli/player` at the untrusted tier.
Every edit is a `@texuli/document` operation in one op log, so undo, redo,
persistence and sync share one history.

> **Status: in development (pre-1.0).** `@texuli/pages` is published on npm
> as `0.11.1`, with provenance (first published as `0.7.0`, with `@texuli/document`;
> built in PLAN_010, ADR-011 in
> [DECISIONS](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)).
> Under 0.x a new minor (`0.12.0`) may contain breaking changes, so pin the
> exact version or use `^0.11.0`, which accepts only 0.11.x
> (see [RELEASE](https://github.com/DailybotHQ/texuli/blob/main/docs/RELEASE.md)).

It sits on layer L8, above the player, because it paints any catalog
component the player can paint (as `@texuli/slides` does). It depends on
`@texuli/document`, `@texuli/editor`, `@texuli/blocks`, `@texuli/player`,
`@texuli/drag`, `@texuli/primitives`, `@texuli/tokens`, `texuli` and
`@texuli/core`; `svelte` (^5.57.2) is a peer dependency.

## Install

```bash
npm install @texuli/pages @texuli/document @texuli/tokens
```

In the Texuli workspace, depend on it as `"@texuli/pages": "workspace:*"`.
Import the token stylesheet once (`@texuli/tokens/base.css`); the editor
and reader import their own CSS.

## Quick start

```svelte
<script lang="ts">
  import { loadUntrustedDocument } from '@texuli/document/schema';
  import { PageEditor } from '@texuli/pages/editor';
  import { PageReader } from '@texuli/pages/reader';
  import '@texuli/tokens/base.css';

  let { json }: { json: string } = $props();
  // Documents from a file, an agent or a share link: validated first.
  const loaded = loadUntrustedDocument(json);
  let doc = $state.raw(loaded.ok ? loaded.document : null);
</script>

{#if doc}
  <PageEditor
    document={doc}
    onChange={(next) => (doc = next)}
    onNavigate={(ref) => console.log('open', ref)}
    createPage={() => ({ ref: 'pages/new-page', title: 'New page' })}
  />
  <PageReader document={doc} />
{/if}
```

Keep the document in `$state.raw`: every change is a new immutable value.

## Subpaths

| Subpath | What it holds | Docs |
| --- | --- | --- |
| `.` | `editor` and `reader` together, plus `PAGES_PACKAGE_VERSION` | this page |
| `editor` | `PageEditor`, the `PagesEditor` state on the op log, the slash menu items and filter, block list and column helpers, the text row mapping | [editor](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/editor.md) |
| `reader` | `PageReader`, the read-only reader with anchored headings and an outline, and `documentOutline` | [reader](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/reader.md) |
| `paged` | `PagedView`, the paged view and print: real pages (size, margins, breaks, headers and footers with page numbers) laid out by `@texuli/document/paged`, printed one sheet per page, isolated to the view | [paged](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/paged.md) |
| `export` | `exportDocument` (Markdown, DOCX and PDF as a `Blob`, writers loaded lazily), `exportFileName` and `downloadBlob` | [export](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/export.md) |
| `host` | `createDocumentPlayerHost`, the `documentHost` that lets `@texuli/player` paint agent `document` blueprints (spec 0.7.0) with the reader, and `checkDocumentDraft`, the document check for `validateDraft` | [host](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/host.md) |
| `collab` | `CollabEditor` and its parts on a `CollabSession` of `@texuli/document/collab`: comments anchored to the text, suggestions with accept and reject, version history with restore, remote carets and an accessible collaborator list (import it lazily) | [collab](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/collab.md) |
| `editor-core`, `reader-core`, `paged-core`, `collab-core`, `host-core` | `PageEditorCore`, `PageReaderCore`, `PagedViewCore`, `CollabEditorCore` and `createDocumentPlayerHostCore`: the same components and host with no default player loader, so a host that passes no `loadPlayer` has no `@texuli/player` reference in its build (G123; from `0.10.0`); `PageReaderCore` and `createDocumentPlayerHostCore` have no default `loadLibraryBase` either, so a design system's `texuli:<theme>` bases never reach the theme library unless the host passes `loadPagesLibraryBase` (G127; from `0.11.0`) | [core entries](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/editor.md#core-entries-without-the-player) |
| `styles.css` | The editor and reader stylesheet (both components import it) | [styles](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/styles.md) |

## What it does

- **Text** rows are `@texuli/editor` surfaces over the document's own text
  blocks (paragraph, heading, list, quote, code), with marks, Markdown
  shortcuts, input-method composition and sink-free paste (the editor's
  `@texuli/editor/paste`). Enter splits into a new row, Backspace at the
  start joins the row before, and the arrow keys hand the caret between
  rows at their edges.
- **Slash menu:** `/` in an empty paragraph opens an APG combobox with a
  listbox (`@texuli/primitives/combobox`) of headings, lists, quote,
  callout, toggle, code, divider, columns, a nested page, component and deck
  embeds and a block of every `@texuli/blocks` family. It filters as you
  type, keeps the best match active (Enter inserts it) and closes on Escape.
- **Block selection and reorder:** each block has a handle
  (`@texuli/primitives/sortable` on `@texuli/drag`): pointer drag between
  any block lists; Space or Enter picks up, arrows move, Space or Enter
  drops and Escape cancels; Alt+Up and Alt+Down move at once from the text
  or the handle; Delete removes. Every move is announced politely.
- **Nested pages:** page-link blocks and a breadcrumb call `onNavigate`;
  each nested page is its own document the host resolves.
- **Columns** of 2 to 4, resized with a window splitter (arrow keys step one
  twelfth; a pointer drag previews and commits once; Escape restores).
- **Embeds:** `component` and `deck` embeds paint through `@texuli/player`
  at the untrusted tier (the player loads on first use); a payload that
  fails validation shows a refusal. Decks present on a stage when the host
  passes `deckHost` (the player's seam). `sheet` and `canvas` embeds are
  typed references today (painting them through `@texuli/sheets` and
  `@texuli/canvas` is planned). Embedded players get no `formHost`,
  `canvasHost` or sheet host, so a component embed holding a
  `schema-form`, `canvas` or `spreadsheet` node is refused rather than painted.
- **Embeds without the player** (from `0.10.0`):
  every component and the document host take `loadPlayer` (`null` turns
  live embeds off), and the core entries (`editor-core`, `reader-core`,
  `paged-core`, `collab-core`, `host-core`) have no default loader, so a
  host that never wants the player has no `@texuli/player` reference in
  its build, not even a lazy one. An embed that needs the player then shows
  a note, or goes to the host's block renderer
  ([core entries](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/editor.md#core-entries-without-the-player)).
- **Host blocks** (from `0.10.0`): a
  `renderBlock` snippet or a `blockHost` (`claim`, `component`, `present`)
  lets the host paint its own wrapped blocks and embeds in the editor, the
  reader and the paged view: what the library refuses, and what the host
  claims. The node is handed as a frozen copy, the refused notice stays
  when nobody paints a node, and the host slot loads only when a host is
  given ([editor](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/editor.md#host-blocks)).
- **Undo and redo** replay the document op log (typing in one block within
  a second is one step); undos are log entries too.
- **Motion:** inserts, removes and reorders glide (FLIP) on the shared
  runtime through `texuli/motion`; reduced motion and `motion={false}` are
  instant.
- **Pages and print:** `PagedView` shows the document on real pages
  (A4, A5, Letter, Legal or a custom size, either orientation, margins,
  explicit page breaks, headings kept with what follows, widow and orphan
  control, headers and footers with page numbers) and prints one sheet per
  page, isolated to the view. It is read-only; editing in paged mode is
  planned.
- **Export:** `exportDocument` writes Markdown, DOCX or PDF as a `Blob`
  with the owned `@texuli/document` writers, loaded on first use.
- **Collaboration:** `CollabEditor` puts the editor on a replica of the
  owned CRDT (`@texuli/document/collab`, ADR-010) through a `SyncAdapter`
  (in-memory and `BroadcastChannel` adapters ship; network transports are
  the host's). The op log stays the single edit path: merged changes arrive
  as `sync` entries, and undo reverts only your own steps. Comments anchor
  to the text through concurrent edits (an APG feed in the sidebar),
  suggestion mode tracks insertions and deletions with accept and reject,
  named versions compare and restore, and remote carets show over the text
  with an accessible list of who is here.

## Security

- No HTML sinks: text renders through text interpolation, the editor
  surface and the `@texuli/blocks` renderers. Links pass `safeHref` and
  images `safeImageSrc` at the `untrusted` tier.
- Every edit is validated by `@texuli/document` (at the `untrusted` tier by
  default); a refused edit changes nothing and is announced.
- Embedded components and decks are validated again by the player, and
  wrapped blocks by their family renderer (two-phase validation, ADR-011).
- Exports never navigate: `downloadBlob` opens only the `blob:` URL it
  creates. The DOCX and PDF writers escape by construction and put links
  through the URL policy at the `untrusted` tier.

## Learn more

- [Editor](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/editor.md)
- [Reader](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/reader.md)
- [Host](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/host.md)
- [Paged view and print](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/paged.md)
- [Export](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/export.md)
- [Collaboration](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/collab.md)
- [Styles](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/styles.md)
- The document engine: [`@texuli/document`](https://github.com/DailybotHQ/texuli/blob/main/packages/document/README.md)
- Decisions: ADR-010 (sync), ADR-011 (document packages), ADR-013 (motion) and ADR-016 (static outputs) in
  [DECISIONS](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)
- Source: [github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli)
  · Issues: [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues)

## Contributing

Contributions are welcome; start at the
[GitHub repository](https://github.com/DailybotHQ/texuli).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-pages).
