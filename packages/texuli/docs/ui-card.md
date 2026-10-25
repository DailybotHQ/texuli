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

## Styles

`@layer tx.components` in `card.css`. Import `@texuli/tokens/base.css` at the app root. Logical properties (`padding-inline`, `border-block-start`, …).
