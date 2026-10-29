# `@texuli/document/paged`

The pagination engine (ADR-011): page sizes, orientation and margins
resolved to points, explicit page breaks, headings kept with what follows,
widow and orphan control, and headers and footers with page fields. It is
a pure layout over measured blocks: the caller injects the measurer, so the
same engine runs in the DOM (the `@texuli/pages` paged view measures
rendered blocks) and without one (the PDF writer measures with font
metrics). Framework-free and DOM-free.

> **Status: in development.** On npm from `0.7.0`, the package's first
> release (pre-1.0).

```ts
import { layoutDocument, PX_PER_PT } from '@texuli/document/paged';

const layout = layoutDocument(doc, (block, unit, contentWidth) => ({
  height: 40,               // the block's height at contentWidth
  lines: [20, 40],          // the bottoms of its lines: where it may split
}));
layout.pages.length;        // pages
layout.pages[0].footer;     // { start: '', center: '1 / 3', end: '' }
```

## Page geometry

`pageGeometry(settings)` resolves `PageSettings` to a `PageGeometry` in
points (1/72 inch): the oriented `width` and `height` (and `widthMm`,
`heightMm`), the `margins` (`PageMargins`: `top`, `bottom`, `inlineStart`,
`inlineEnd`) and the content box (`contentWidth`, `contentHeight`). It is
total: an unknown size falls back to A4, values are clamped (sides 50 to
1,000 mm, margins 0 to 100 mm), and margins never leave less than 10 mm of
content.

- `PAGE_PRESETS`: the portrait sizes in millimetres (A4 210 × 297, A5
  148 × 210, Letter 215.9 × 279.4, Legal 215.9 × 355.6). A `custom` page
  uses the settings' `width` and `height`.
- `DEFAULT_MARGINS`: one inch (25.4 mm) on every side.
- `DEFAULT_PAGE_SETTINGS`: A4 portrait, for a document without `page`.
- `MM` (points per millimetre) and `PX_PER_PT` (CSS pixels per point).
- `documentPageSettings(doc, overrides)`: the document's settings with
  overrides merged over them (a preset size in the overrides drops a custom
  width and height).

## Layout

`layoutDocument(doc, measure, options)` returns a `PagedLayout`: the
`settings` and `geometry` used, the `units` and their `measures`, and the
`pages` (each a `LaidOutPage`: a 1-based `number`, its `slices`, and the
resolved `header` and `footer`, each a `ResolvedBand` or `null`), plus
`truncated` when `maxPages` stopped it.

The measurer is a `BlockMeasurer`: `(block, unit, contentWidth) =>
UnitMeasure`, where a `UnitMeasure` is the block's `height` and,
optionally, `lines`: the bottom of each line from the block's top, the
places it may split. `LayoutOptions`:

- `page`: page settings merged over the document's;
- `scale`: units per point for the measurer (default 1; the paged view
  passes `PX_PER_PT` and measures in CSS pixels);
- `gap`: space between two blocks on a page (never at a page top);
- `orphans` and `widows`: lines of a split block kept at a page bottom and
  carried to the next page top (default 2 each);
- `maxPages`: the page cap (default 5,000);
- `pageNumbers`: when the settings have no footer, use `DEFAULT_FOOTER`
  (`{page} / {pages}` centered); default true.

## Pagination

`pagedUnits(doc)` turns the top-level blocks into `PagedUnit`s: the block
`id`, its `index` and `type`, `breakBefore` (the block is in `page.breaks`;
never the first block), `keepWithNext` (headings) and `splittable`
(paragraphs, code, lists, quotes, callouts, toggles, and wrapped `table`
blocks; columns, media, embeds and other wrapped blocks never split).

`paginate(units, measures, options)` places them (`PaginateOptions`: the
`contentHeight` plus the layout options above) and returns a `Pagination`:
`pages` (`PagedPage`: `number` and `slices`) and `truncated`. Each
`PageSlice` shows the part `from`–`to` of a block, at `top` in the page's
content box, and says whether it is `continued` from the previous page,
`continues` on the next, or was `clipped`. The rules, in order:

1. An explicit break starts a new page.
2. A heading moves to the next page when it and the first lines of what
   follows (up to three chained headings) do not fit.
3. A block that fits is placed whole.
4. A splittable block splits at its last line that fits, keeping at least
   `orphans` lines on this page and `widows` on the next; when that is
   impossible on a partly filled page, it moves to the next page.
5. A block taller than a page that cannot split at lines is clipped across
   pages (`clipped`), the last resort.

It is linear in units and lines, and total: non-finite or negative
heights, unsorted lines and a non-finite content height are tolerated and
the output stays finite and bounded by `maxPages`.

## Headers and footers

`resolveBandText(template, fields)` replaces `{page}`, `{pages}` and
`{title}` in one pass and keeps any other text, braces included. A
`PageBand` (`start`, `center`, `end`) comes from `page.header` and
`page.footer`.
