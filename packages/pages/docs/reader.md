# `@texuli/pages/reader`

The read-only reader: the same document the editor edits, rendered as an
`article` with anchored headings and an "On this page" outline. It loads no
editing code.

> **Status: in development.** Not on npm yet (first release planned for
> `0.7.0`).

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
| `class` | — | Extra classes on the root |

Blocks render as semantic elements: paragraphs, `h1` to `h4` (plus the
offset), `pre`, `ul` and `ol` (todo items say "Done" or "Not done"),
`blockquote`, `hr`, `figure`, `aside` for callouts, `details` for toggles,
and a grid for columns. Text renders through text interpolation; links pass
`safeHref` at the untrusted tier with `rel="noopener noreferrer nofollow"`.
Wrapped blocks paint with their `@texuli/blocks` family renderer and embeds
with `@texuli/player`, as in the editor.

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
and `PageRef` (see [editor](editor.md#embeds-and-media)).
