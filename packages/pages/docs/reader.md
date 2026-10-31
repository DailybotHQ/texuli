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

## Design systems

> **In development for `0.10.0`, not on npm.**

When the document carries `designSystem` (spec 0.10.0,
[ADR-024](../../../docs/DECISIONS.md#adr-024-design-systems-on-every-surface)),
the reader loads its design-system step with `import()` (a document
without one never loads it; a test walks the static imports): a `ref`
goes to `designSystems.resolve` (`texuli:<theme>` falls back to the theme
library), an inline document is validated at `designSystems.trust` and
both are compiled by `@texuli/tokens/design-system/compile`, then applied
to the article with `applyDesignSystem` (`data-tx-ds`, `data-tx-scope`,
`data-tx-mode` and the variables). Fonts load only for host-resolved
documents or at the `developer` level. Nothing resolves, the resolver
throws, another document comes back, or the compiler refuses it (for
example `aa-text`, `url-refused`): the reader keeps the default theme,
sets `data-tx-pages-design-system="refused"` and shows
`labels.designSystemRefused` in a `role="status"` paragraph. Never throws.

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
