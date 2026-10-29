# @texuli/pages

The block document editor and reader for
[Texuli](https://texuli.com), an MIT-licensed Svelte 5 component library by
Dailybot, Inc. (*Small pieces. Infinite possibilities.*). It edits
`@texuli/document` documents: text through `@texuli/editor`, a slash menu of
every block type, block selection and drag on `@texuli/drag` with keyboard
equivalents, nested pages, resizable columns, and live embeds of catalog
components and decks painted by `@texuli/player` at the untrusted tier.
Every edit is a `@texuli/document` operation in one op log, so undo, redo,
persistence and (later) sync share one history.

> **Status: in development (pre-1.0).** `@texuli/pages` is not on npm yet.
> It is built in PLAN_010 and its first release is planned for `0.7.0`
> (ADR-011 in
> [DECISIONS](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)).
> Its version is the `0.0.0` placeholder until then. Under 0.x a new minor
> may contain breaking changes
> (see [RELEASE](https://github.com/DailybotHQ/texuli/blob/main/docs/RELEASE.md)).

It sits on layer L8, above the player, because it paints any catalog
component the player can paint (as `@texuli/slides` does). It depends on
`@texuli/document`, `@texuli/editor`, `@texuli/blocks`, `@texuli/player`,
`@texuli/drag`, `@texuli/primitives`, `@texuli/tokens`, `texuli` and
`@texuli/core`; `svelte` (^5.57.2) is a peer dependency.

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
| `styles.css` | The editor and reader stylesheet (both components import it) | [styles](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/styles.md) |

Planned, not built yet (ADR-011): `paged` (the paged view and print) is
planned for T-doc-paged, `export` (PDF, DOCX and Markdown downloads) is
planned for T-doc-paged, and `collab` (comments, suggestions, history and
presence) is planned for T-doc-collab. They are not in the package exports
until they land.

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
  passes `deckHost` (the player's seam). `sheet` and `canvas` embeds stay
  typed references until their packages ship.
- **Undo and redo** replay the document op log (typing in one block within
  a second is one step); undos are log entries too.
- **Motion:** inserts, removes and reorders glide (FLIP) on the shared
  runtime through `texuli/motion`; reduced motion and `motion={false}` are
  instant.

## Security

- No HTML sinks: text renders through text interpolation, the editor
  surface and the `@texuli/blocks` renderers. Links pass `safeHref` and
  images `safeImageSrc` at the `untrusted` tier.
- Every edit is validated by `@texuli/document` (at the `untrusted` tier by
  default); a refused edit changes nothing and is announced.
- Embedded components and decks are validated again by the player, and
  wrapped blocks by their family renderer (two-phase validation, ADR-011).

## Learn more

- [Editor](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/editor.md)
- [Reader](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/reader.md)
- [Styles](https://github.com/DailybotHQ/texuli/blob/main/packages/pages/docs/styles.md)
- The document engine: [`@texuli/document`](https://github.com/DailybotHQ/texuli/blob/main/packages/document/README.md)
- Decisions: ADR-011 (document packages) and ADR-013 (motion) in
  [DECISIONS](https://github.com/DailybotHQ/texuli/blob/main/docs/DECISIONS.md)
- Source: [github.com/DailybotHQ/texuli](https://github.com/DailybotHQ/texuli)
  · Issues: [github.com/DailybotHQ/texuli/issues](https://github.com/DailybotHQ/texuli/issues)

## Contributing

Contributions are welcome; start at the
[GitHub repository](https://github.com/DailybotHQ/texuli).

## License

MIT © Dailybot, Inc. Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-pages).
