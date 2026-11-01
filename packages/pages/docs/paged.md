# `@texuli/pages/paged`

The paged view and print: the document laid out on real pages (size,
orientation, margins, explicit page breaks, headers and footers with page
numbers) by the `@texuli/document/paged` engine, measured in the DOM. On
screen the pages stack like sheets of paper; in print each page is one
sheet at the page size, and only the mounted view prints.

> **Status: in development.** On npm from `0.7.0`, the package's first
> release (pre-1.0). The paged view is read-only: editing in paged mode is planned;
> edit with `PageEditor` and show `PagedView` as the print preview.

```svelte
<script lang="ts">
  import { PagedView } from '@texuli/pages/paged';
  let { doc } = $props(); // a validated TexuliDocument
</script>

<PagedView document={doc} page={{ size: 'letter' }} onLayout={(layout) => console.log(layout.pages.length)} />
```

Print with the browser (Ctrl/Cmd+P, or `window.print()`): every page box
names its `@page` (`tx-pages-a4-portrait`, `tx-pages-a4-landscape`,
`tx-pages-a5-portrait`, `tx-pages-a5-landscape`,
`tx-pages-letter-portrait`, `tx-pages-letter-landscape`,
`tx-pages-legal-portrait`, `tx-pages-legal-landscape`, or
`tx-pages-custom`), so the printed sheets match the pages on screen. A
browser test prints with Chromium and checks one PDF page per page of the
model, at the page size.

## `PagedView`

| Prop | Default | Meaning |
| --- | --- | --- |
| `document` | — | The document, validated (`loadUntrustedDocument` from `@texuli/document/schema`); its `page` settings apply |
| `page` | — | Page settings merged over the document's (size, orientation, margins, header, footer, breaks) |
| `labels` | English | Partial `PagesLabels` and `PagedLabels` |
| `pageNumbers` | `true` | Number the pages when the settings have no footer |
| `gap` | `12` | Space between blocks on a page, in CSS pixels |
| `orphans`, `widows` | `2` | Lines of a split block kept at a page bottom and carried to the next top |
| `isolate` | `true` | Mark the view as the print target (`data-tx-print-isolate`): while it is mounted, printing prints only it |
| `fit` | `true` | Scale the sheets down (CSS `zoom`) to fit narrow containers on screen; print is always 1:1 |
| `anchorPrefix` | `'paged-'` | Prefix for heading ids, so a reader and a paged view on one page never share an id |
| `anchorFor` | — | The host's own heading anchors, as in the reader (`HeadingAnchorFor`) |
| `onLayout` | — | Called with every new `PagedLayout` (pages and slices) |
| `onNavigate`, `pageHref` | — | Page links, as in the reader |
| `resolveEmbed`, `resolveMedia`, `deckHost` | — | Embeds and media, as in the reader |
| `reducedMotion` | `false` | Paint embeds without motion |
| `renderBlock`, `blockHost` | — | The host's own blocks, as in the reader ([host blocks](editor.md#host-blocks); the types `PagesBlockHost`, `PagesBlockClaim`, `PagesBlockHostProps`, `PagesBlockHostRequest`, `PagesBlockSnippet` and `PagesHostNode` are exported here too) |
| `loadPlayer` | the package loader | A `PagesPlayerLoader` for live embeds; `null` turns them off. `PagedViewCore`, from `@texuli/pages/paged-core` (from `0.10.0`), is `PagedView` with no default, so its build has no `@texuli/player` reference; the entry exports `PagesPlayerLoader` and `PagesPlayerModule`, and `@texuli/pages/paged` exports `PagedViewCore` too ([core entries](editor.md#core-entries-without-the-player)) |
| `class` | — | Extra classes on the root |

How it works:

1. Every top-level block renders once in a measuring copy at the page's
   content width (hidden, `inert` and `aria-hidden`, with no ids).
   `measureUnit(element)` reads its height and its split points: the
   bottoms of its text lines from `Range.getClientRects()`, merged per
   visual line by `lineBottoms`, minus any that fall inside an image, a
   canvas, an embedded frame or a table row (`ATOMIC_SELECTOR`, through
   `splitPoints`).
2. `layoutDocument` lays the measured blocks onto pages. A resize of any
   measured block (an embed that loads, a web font that arrives) lays the
   pages out again; nothing changes while printing.
3. Each page paints its slices. A block split across pages renders whole on
   its first page, clipped, and again on the next page as an `inert` copy,
   so the tab order and assistive technology meet each block once.

Accessibility: the root is an `article` named by the document title, each
page a `group` named "Page 1 of 7" (`PagedLabels.pageOf`), and the header
and footer bands are `aria-hidden` (the page names carry the numbers). The
root is `aria-busy` until the first layout, with a polite status. A browser
test runs axe in light, dark and forced colors.

Print isolation follows the slides print view (G80): the isolation rules
apply only while a `data-tx-print-isolate="true"` target is mounted, so a
print before the view mounts prints the page as is, never a blank sheet.
Pass `isolate={false}` to print the view with the rest of the page.

A `custom` page size prints through an `@page tx-pages-custom` rule that
`adoptCustomPage(document, widthMm, heightMm)` adds as a constructed
stylesheet (CSSOM, no style element; `customPageRule` writes it from finite
numbers only); `pageName(geometry)` names the page of a geometry.

## Labels

`DEFAULT_PAGED_LABELS` and `resolvePagedLabels(overrides)`: `paged` (the
root's name when the document has no title), `pageOf(page, total)` and
`paginating` (the status while laying out). Empty values never replace a
default.

## Stylesheet hooks

`PagedView` imports its stylesheet (`src/paged/paged.css`) with the editor
and reader stylesheet. Hooks:

- `.tx-pages-paged`: the root (the desk color is
  `--tx-pages-paged-desk`, the paper `--tx-pages-paged-paper`, the bands
  `--tx-pages-paged-band`);
- `.tx-pages-paged__sheets`: the stack of pages;
- `.tx-pages-paged__page`: one page (`data-page`, `data-page-name`);
- `.tx-pages-paged__body`: the content box;
- `.tx-pages-paged__slice`: a block or part of one (`data-block-id`,
  `data-continued`, `data-continues`);
- `.tx-pages-paged__unit`: a block's wrapper, in a slice and in the
  measuring copy;
- `.tx-pages-paged__band`: the header or footer (`data-band`);
- `.tx-pages-paged__measure`: the measuring copy.

Forced colors give pages a `CanvasText` border; logical properties keep
right-to-left documents mirrored.
