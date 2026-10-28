# Card

**Package:** `texuli` · **Import:** `texuli/card` or `texuli`

Surface container with optional media, header, body, footer and auto-fit grid.

| Export | Role |
| --- | --- |
| `Card` | Root surface; optional `href` for a clickable card (URL policy) |
| `CardMedia` | Image banner (`safeImageSrc`) |
| `CardHeader` / `CardTitle` / `CardDescription` | Title block (`CardTitle` is a real heading level) |
| `CardContent` | Body |
| `CardFooter` | Actions row |
| `CardGrid` | Auto-fill grid of cards (`minItemWidth`, `gap`) |

## Variants

- `elevated` (default) — soft shadow  
- `flat` — border only  

## Clickable card

```svelte
<Card href="https://example.com/item" linkLabel="Open item">
  <CardHeader>
    <CardTitle>Item</CardTitle>
    <CardDescription>Fictional summary.</CardDescription>
  </CardHeader>
</Card>
```

`href` uses `@texuli/core/url-policy` `safeHref` (default trust `developer`). Unsafe schemes render a non-interactive `div`.

A link card also takes the anchor attributes `target`, `rel` and `download`
(`true`, or a suggested file name). With `target="_blank"`, `noopener` is
always added to `rel` (your tokens are kept). They are dropped when the card
is not a link (no `href`, or a rejected one).

```svelte
<Card href="https://example.com/report.csv" download="report.csv">…</Card>
<Card href="https://example.com/docs" target="_blank" rel="external">…</Card>
```

## Media

```svelte
<CardMedia src="https://example.com/photo.jpg" alt="Harbor at dusk" />
```

`src` uses `safeImageSrc` (default trust `untrusted`).

## Grid

```svelte
<CardGrid minItemWidth="16rem" gap="md">
  <!-- cards -->
</CardGrid>
```

Only simple CSS lengths are accepted for `minItemWidth` (no injection).

`maxColumns` (a whole number ≥ 1) caps the columns however wide the grid
gets; narrow containers still drop to fewer columns at `minItemWidth`. Invalid
values are ignored. The gap is the `--tx-card-grid-gap` custom property, set
by `gap`.

```svelte
<CardGrid minItemWidth="14rem" maxColumns={3}>…</CardGrid>
```

## Styles

`@layer tx.components` in `card.css`. Import `@texuli/tokens/base.css` at the app root. Logical properties (`padding-inline`, `border-block-start`, …).
