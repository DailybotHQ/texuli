# `@texuli/pages/reader`

The read-only reader: the same document the editor edits, rendered as an
`article` with anchored headings and an "On this page" outline. It loads no
editing code.

> **Status: in development.** On npm from `0.7.0`, the package's first
> release (pre-1.0).

```svelte
<script lang="ts">
  import { PageReader } from '@texuli/pages/reader';
  let { doc } = $props(); // a validated TexuliDocument
</script>

<PageReader document={doc} anchorPrefix="doc-" pageHref={(ref) => `/${ref}/`} />
```

## `PageReader`

| Prop | Default | Meaning |
| --- | --- | --- |
| `document` | — | The document, validated (`loadUntrustedDocument` from `@texuli/document/schema`) |
| `labels` | English | Partial `PagesLabels` |
| `outline` | `true` | Show the outline `nav` when there are at least `outlineMin` headings |
| `outlineMin` | `2` | Fewer headings show no outline |
| `anchorPrefix` | `''` | Prefix for heading ids, so two readers on one page never share an id |
| `headingOffset` | `0` | Added to every heading level (clamped to 6), for a reader under a page heading |
| `trail`, `onNavigate`, `pageHref` | — | The breadcrumb and page links, as in the editor (`PageRef`) |
| `resolveEmbed`, `resolveMedia`, `deckHost` | — | Embeds and media, as in the editor (`EmbedResolver`, `MediaResolver`) |
| `reducedMotion` | `false` | Paint embeds without motion |
| `designSystems` | — | `PagesDesignSystems` (spec 0.10.0): `resolve(ref)` for the document's `designSystem.ref` (a document or a compiled design system; may be async; the reader never fetches), `mode` (`light`, `dark`) and `trust` for an inline document (default `untrusted`) |
| `onDesignSystem` | — | Called with a `PagesDesignSystemEvent`: `{ status: 'applied', id, source }` or `{ status: 'refused', code, path, message }` |
| `renderBlock`, `blockHost` | — | The host's own blocks: a snippet and a `PagesBlockHost` ([host blocks](editor.md#host-blocks)) |
| `loadPlayer` | the package loader | A `PagesPlayerLoader` for live embeds; `null` turns them off ([core entries](editor.md#core-entries-without-the-player)) |
| `loadLibraryBase` | `loadPagesLibraryBase` (`PageReader`); none on `PageReaderCore` | A `PagesLibraryBaseLoader` for a design system's `texuli:<theme>` reference or base that `designSystems.resolve` leaves `undefined`; none (or `null`) refuses it ([design systems](#design-systems); G127, from `0.11.0`) |
| `class` | — | Extra classes on the root |

Blocks render as semantic elements: paragraphs, `h1` to `h4` (plus the
offset), `pre`, `ul` and `ol` (todo items say "Done" or "Not done"),
`blockquote`, `hr`, `figure`, `aside` for callouts, `details` for toggles,
and a grid for columns. Text renders through text interpolation; links pass
`safeHref` at the untrusted tier with `rel="noopener noreferrer nofollow"`.
Wrapped blocks paint with their `@texuli/blocks` family renderer and embeds
with `@texuli/player`, as in the editor, or with the host's renderer
([host blocks](editor.md#host-blocks): `PagesBlockHost`, `PagesBlockClaim`,
`PagesBlockHostProps`, `PagesBlockHostRequest`, `PagesBlockSnippet`,
`PagesHostNode`, `PagesReadonly`).

## `@texuli/pages/reader-core`

> **New in `0.10.0`.**

`PageReaderCore` is `PageReader` with no default `loadPlayer`: a host on
this entry has no `@texuli/player` reference in its build, and embeds
paint only with the host's `PagesPlayerLoader` (its result is a
`PagesPlayerModule`). Every other export is the same as
`@texuli/pages/reader`, which exports `PageReaderCore` too. See
[core entries](editor.md#core-entries-without-the-player). It has no default
`loadLibraryBase` either (G127, from `0.11.0`): pass
`loadPagesLibraryBase` (exported by both reader entries, with the
`PagesLibraryBaseLoader` type) to resolve a design system's `texuli:<theme>`
bases from the token theme library ([design systems](#design-systems)).

## Design systems

> **New in `0.10.0`.**

When the document carries `designSystem` (spec 0.10.0,
[ADR-024](../../../docs/DECISIONS.md#adr-024-design-systems-on-every-surface)),
the reader loads its design-system step with `import()` (a document
without one never loads it; a test walks the static imports): a `ref`
goes to `designSystems.resolve`, an inline document is validated at
`designSystems.trust` and both are compiled by
`@texuli/tokens/design-system/compile-core`, then applied
to the article with `applyDesignSystem` (`data-tx-ds`, `data-tx-scope`,
`data-tx-mode` and the variables). A `designSystems.mode` the design
system did not compile paints its first compiled mode (a
dark-only design system paints dark under a light host), and
`data-tx-mode` names the mode painted. Fonts load only for host-resolved
documents or at the `developer` level. A compiled copy from `resolve` must
carry `id`, `vars` and `attrs` (the player's check); anything else is
validated as a document. Nothing resolves, the resolver throws, another
document comes back, the compiler refuses it (for example `aa-text`,
`url-refused`), or applying fails (`design-system-refused`): the reader
keeps the default theme, drops the design system applied before, sets
`data-tx-pages-design-system="refused"`, reports the event and shows
`labels.designSystemRefused` in a `role="status"` paragraph. Never throws.

A `texuli:<theme>` reference or `extends` base that `resolve` leaves
`undefined` goes to `loadLibraryBase` (G127, from `0.11.0`), which may
return a design-system document or a token `Theme` (compiled as
`fromTheme` of it, for the reference as for a base). `PageReader` (and `createDocumentPlayerHost`) default it to
`loadPagesLibraryBase`, which loads the token theme library on first use.
`PageReaderCore` (and `createDocumentPlayerHostCore`) have no default:
without a loader such a design system is refused
(`design-system-unresolved`, or `invalid-value` for an `extends` base), and
the build has no reference to the theme library. A host on every core
entry with no loaders has no theme library module and no `@texuli/player`
in any chunk: 78 chunks and none from the library, against 231 chunks, 152
of them with library modules, before G127 (`tests/bundle-graph.test.ts`).
The editor, paged and collab views never apply a design system, so they
take no `loadLibraryBase`.

```svelte
<script lang="ts">
  import { loadPagesLibraryBase, PageReaderCore } from '@texuli/pages/reader-core';
  let { doc } = $props();
</script>

<!-- Or pass the host's own loader; with none, texuli:<theme> design systems are refused. -->
<PageReaderCore document={doc} loadLibraryBase={loadPagesLibraryBase} />
```

## Outline and anchors

`documentOutline(doc, { prefix })` returns every heading in reading order
(inside callouts, toggles, quotes and columns too) as an `OutlineEntry`
(`id`, `anchor`, `level`, `text`). Anchors are `slugify(text)` (folded, lower
case, `a-z`, `0-9` and dashes, at most 64 characters; `section` when empty),
made unique with `-2`, `-3`… One iterative walk, linear in the document.

## Shared exports

The reader also exports what it shares with the editor: `planEmbed`,
`componentBlueprint`, `deckBlueprint`, `wrappedBlockInput`, `EmbedPlan`,
`BlueprintNode`, `EmbedResolver`, `mediaSource`, `pageLinkHref`,
`MediaResolver`, `DEFAULT_PAGES_LABELS`, `resolvePagesLabels`, `PagesLabels`
and `PageRef`, plus the design-system types `PagesDesignSystems` and
`PagesDesignSystemEvent` (see [editor](editor.md#embeds-and-media)).
