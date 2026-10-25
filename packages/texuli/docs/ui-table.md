# Table

**Package:** `texuli` · **Import:** `texuli/table` or `texuli`

A styled, static, accessible table on the token contract: caption, plain,
striped or grid rows, three densities, numeric and footer cells, a selected
row, an empty state, a sticky header in a capped area, and rows that stack into
labelled cards when the table is narrow. It renders real `<table>` markup.
Sorting, filtering, selection and pagination belong to the data grid
(`@texuli/data`), which builds on the same look.

| Export | Element | Role |
| --- | --- | --- |
| `Table` | `div` + `table` | Scroll wrapper and table; `variant`, `density`, `stack`, `stickyHeader`, `maxBlockSize`, `label`, `busy` |
| `TableCaption` | `caption` | Names the table; `hidden` keeps it for assistive technology only |
| `TableHeader` / `TableBody` / `TableFooter` | `thead` / `tbody` / `tfoot` | Row groups |
| `TableRow` | `tr` | `selected` highlights the row |
| `TableHead` | `th` | Header cell; `scope` defaults to `col` (use `row` for row headers); `align`, `numeric` |
| `TableCell` | `td` | Data cell; `align`, `numeric`, `label` (stacked label override) |
| `TableEmpty` | `tr` + `td` | A message row spanning `colspan` columns |
| `fillStackLabels(table)` | — | The helper that copies header text onto cells for stacking |
| `tableClass`, `TABLE_VARIANTS`, `TABLE_DENSITIES`, `TABLE_STACKS`, `TABLE_ALIGNS` | — | Class composer and option lists |

```svelte
<script lang="ts">
  import {
    Table, TableBody, TableCaption, TableCell, TableFooter,
    TableHead, TableHeader, TableRow,
  } from 'texuli/table';
</script>

<Table variant="striped" stack="sm">
  <TableCaption>Recent invoices</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Invoice</TableHead>
      <TableHead>Customer</TableHead>
      <TableHead numeric>Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableHead scope="row">INV-1042</TableHead>
      <TableCell>Harbor Notes</TableCell>
      <TableCell numeric>$1,280.00</TableCell>
    </TableRow>
  </TableBody>
  <TableFooter>
    <TableRow>
      <TableHead scope="row" colspan={2}>Total</TableHead>
      <TableCell numeric>$1,280.00</TableCell>
    </TableRow>
  </TableFooter>
</Table>
```

## Options

| Prop (`Table`) | Default | Meaning |
| --- | --- | --- |
| `variant` | `plain` | `plain` (row dividers), `striped` (zebra body rows), `grid` (dividers between columns too) |
| `density` | `default` | `compact`, `default` or `comfortable` cell padding, multiplied by the theme's `--tx-density` |
| `stack` | `never` | `sm` stacks rows below a 30rem table width, `md` below 40rem |
| `stickyHeader` | `false` | The header row stays visible while the table's own area scrolls |
| `maxBlockSize` | none | Caps the height (`20rem`, `60vh`, `320px`…); only plain lengths are accepted, anything else is ignored |
| `label` | none | Names the scroll area when the table overflows (translated text); the caption names it otherwise |
| `busy` | `false` | Sets `aria-busy="true"` while rows load |
| `class` / `wrapperClass` | none | Classes for the `<table>` and for the scroll wrapper; other attributes go on the `<table>` |

The component has no built-in text, so every visible or announced string is
the caller's and can be translated.

## Accessibility

- **Native semantics.** It is a real table with `caption`, `thead`, `tbody`, `tfoot` and `th scope`, so screen readers announce headers with each cell. Use `TableHead scope="row"` for the cell that names a row.
- **Scrolling.** A table wider or taller than its area scrolls inside the wrapper. When it overflows (measured with a `ResizeObserver`), the wrapper takes `tabindex="0"` so keyboard users can scroll it. If the table has a `label` or a caption, it also becomes a `region` with that name. A table that fits adds no tab stop.
- **Stacking.** Below the `stack` width, each row becomes a card of label / value pairs. CSS `display` changes drop native table semantics in some browsers, so a table with `stack` set always states explicit roles (`table`, `rowgroup`, `row`, `columnheader`, `rowheader`, `cell`). The header row is hidden visually but stays in the accessibility tree. Each cell's label is copied from its column header (kept current with a `MutationObserver`), or comes from `TableCell label`. The label is drawn with `content: attr(data-label) / ""`, so browsers that support alternative text for generated content do not announce it twice. A cell that spans several columns gets no label.
- **Selected rows.** The selected fill wins over the striped zebra fill, in forced colors too (`Highlight` with `HighlightText`). `selected` is visual only (accent fill plus an edge mark that does not rely on color). A static table has no selection semantics, so say it in the row as well, for example with a checked checkbox or text. The data grid owns real selection.
- **Contrast.** Header text is `muted-foreground` on `muted`, cells use `surface-foreground` on `surface` (and on `muted` for stripes), and selected rows use `accent-foreground` on `accent`. These are all pairs the token contract checks for AA. In forced colors, borders use `CanvasText` and selected rows use `Highlight` / `HighlightText`.
- **RTL and motion.** All spacing and borders are logical properties, and alignment uses `start` / `end`. The selected-row edge mark (an inset shadow, which has no logical form) is mirrored under `:dir(rtl)`. There is no motion.

## Verified

- `pnpm vitest run packages/texuli/tests/table.test.ts`: 21 tests (classes, every variant and density, sections and scopes, wrapper and table classes, busy, the sticky cap and its injection guard, overflow to a focusable named region (by label or by caption), stacking roles and labels in both breakpoints, relabelling after a row is added, the parts, `fillStackLabels` with `colspan`, author labels and stale labels, and `isScrollable`).
- In the browser, with Chromium, WebKit and the Pixel 7 in light and dark, the `texuli-table` example passes axe. Keyboard scrolling of the capped table works, and its header stays pinned. The narrow table stacks with visible labels, and its cells and headers remain in the accessibility tree. The wide table does not stack. RTL numeric headers align to the end.
- axe also passes with four generated themes (blue/slate, rose/stone, green/tinted and yellow/warm, from `@texuli/tokens/generator`) in light and dark, and with forced colors emulated. These runs were scratch checks, not committed specs, because the fixture app does not load theme tokens yet.
- Visual baselines: `texuli-table` in light and dark, on Chromium and the Pixel 7.

## Size

`texuli/table` measures 3.05 KiB gzip (+1.32 KiB CSS) with `pnpm size` (2026-10-24), within the 12 KiB `texuli/*` default. CSS is `@layer tx.components` in `table.css`. Import `@texuli/tokens/base.css` at the app root.

## Limits

- Static only: there is no sorting, filtering, selection, pagination or virtualization (see `@texuli/data`).
- The sticky header sticks within the table's own scroll area, so set `maxBlockSize` to use it. A table whose wrapper scrolls horizontally cannot also stick to the page's scroll.
- `stack` is fixed for a table's lifetime, because the parts read it once.
- Stacking shows one label / value pair per cell. Multi-row headers use the last header row for labels.
