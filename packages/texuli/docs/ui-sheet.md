# Sheet, Drawer, DetailPanel and ResponsiveModal

**Package:** `texuli` · **Import:** `texuli/sheet`

The sheet family supplies token-styled overlays built on
`@texuli/primitives/sheet`:

| Component | Behavior |
| --- | --- |
| `Sheet` | Modal overlay attached to a logical or physical edge |
| `Drawer` | Sheet with pointer dragging, optional snap points and a handle |
| `DetailPanel` | Non-modal panel that leaves the page usable |
| `ResponsiveModal` | Centered modal on wide screens and bottom drawer on phones |

Each namespace exposes the primitive `Root`, `Trigger`, `Portal`, `Title`,
`Description`, and `Close` parts, and the styled `Header`, `Body`, `Footer`
and `CloseButton` parts (see "Parts" below). `Root` also takes `stack`, a
`LayerStack` to register on instead of the page-wide one. Content accepts a `size` (`sm`, `md`, `lg`,
or `xl`) and a consumer `class`. `Sheet.Content` defaults to logical `start`;
`Drawer.Content` and `DetailPanel.Content` default to logical `end`. These
follow the trigger direction across portals. Explicit `left` and `right` sides
stay physical.

```svelte
<script lang="ts">
  import { Drawer, DetailPanel, Sheet } from 'texuli/sheet';
</script>

<Sheet.Root>
  <Sheet.Trigger>Filters</Sheet.Trigger>
  <Sheet.Portal>
    <Sheet.Overlay />
    <Sheet.Content side="start" size="lg">
      <Sheet.Title>Filters</Sheet.Title>
      <Sheet.Description>Narrow the fictional orders.</Sheet.Description>
      <Sheet.Close>Apply</Sheet.Close>
    </Sheet.Content>
  </Sheet.Portal>
</Sheet.Root>

<Drawer.Root>
  <Drawer.Trigger>Cart</Drawer.Trigger>
  <Drawer.Portal>
    <Drawer.Overlay />
    <Drawer.Content snapPoints={[0.4, 0.7, 1]}>
      <Drawer.Handle label="Resize cart" />
      <Drawer.Title>Cart</Drawer.Title>
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>

<DetailPanel.Root>
  <DetailPanel.Trigger>Order details</DetailPanel.Trigger>
  <DetailPanel.Portal>
    <DetailPanel.Content>
      <DetailPanel.Title>Order details</DetailPanel.Title>
      <DetailPanel.Close>Close</DetailPanel.Close>
    </DetailPanel.Content>
  </DetailPanel.Portal>
</DetailPanel.Root>
```

The package stylesheet is imported by the content components. It uses logical
insets, theme tokens, focus indicators, reduced-motion behavior and forced
colors. The `texuli-sheet` example includes all size variants, logical sides,
RTL, a drawer with snap points, a non-modal detail panel and the responsive
modal.

## Parts: header, body, footer and close

Every surface (`Sheet`, `Drawer`, `DetailPanel`, `ResponsiveModal`) takes the
same styled parts. They read plain `--tx-*` tokens, so they look the same on
every surface:

| Part | Renders |
| --- | --- |
| `Header` | `title` (the primitive `Title`: it names the sheet), `description` (`Description`), extra `children`, and a `CloseButton` unless `hideClose`. `closeLabel` names it (default `Close`). Omit `title` to render your own `Title` in `children` |
| `Body` | The region that scrolls between the header and the footer |
| `Footer` | The actions row; it stays visible while the body scrolls and pads for the bottom safe area |
| `CloseButton` | An icon close control; `label` is its accessible name (default `Close`) |

With a `Body` part the surface drops its own padding and scrolling, so the
header and footer stay put. Class builders: `sheetHeaderClass`,
`sheetBodyClass`, `sheetFooterClass`, `sheetTitleClass`,
`sheetDescriptionClass`, `sheetCloseClass` (use the title and description
classes on your own `Title` and `Description`).

```svelte
<Drawer.Root bind:open>
  <Drawer.Portal>
    <Drawer.Overlay />
    <Drawer.Content>
      <Drawer.Header title="Cart" description="Two items." closeLabel="Close cart" />
      <Drawer.Body>…</Drawer.Body>
      <Drawer.Footer><Drawer.Close>Check out</Drawer.Close></Drawer.Footer>
    </Drawer.Content>
  </Drawer.Portal>
</Drawer.Root>
```

## ResponsiveModal: `force` and host sizing

`ResponsiveModal.Content` is a centered dialog when there is room and a
bottom drawer when there is not (`data-side` is `center` or `bottom`,
`data-presentation` is `dialog` or `sheet`).

| Prop | Default | Role |
| --- | --- | --- |
| `query` | `(max-width: 40rem)` | Viewport media query that picks the sheet |
| `force` | `auto` | `dialog` or `sheet` always shows that presentation and ignores the width |
| `host` | none | Size by this element's inline size instead of the viewport (a preview frame, a split pane), observed with a `ResizeObserver`; `query` is then ignored |
| `breakpoint` | `640` | With `host`: the inline size in px at or below which the sheet shows |

The server render and the first client frame show the dialog; the width is
read after mount, so the markup is SSR-safe.

## Non-modal dismissal (FIX-sheet-dismiss-outside)

`DetailPanel.Content` and a non-modal `Sheet.Content` (`modal={false}`)
forward `dismissOutside` and `closeOnEscape` to the primitive. Both default
to `false`.
- `dismissOutside` closes the panel on an outside press or outside focus;
  the trigger never counts.
- `closeOnEscape` closes it on Escape anywhere on the page.

`Drawer` is always modal, so they have no effect there. The catalog
manifests list them as host props.

## Motion

`motion` on `Sheet.Content`, `Drawer.Content`, `DetailPanel.Content` and
`ResponsiveModal.Content`: the panel slides from the edge it is attached to
(a centered one rises), and `Sheet.Overlay` fades, through
`@texuli/core/motion` ([ui-motion](ui-motion.md)). A drawer's slide ends at
its snap point. The CSS `transform` transition stays only for drag snapping.
`Drawer.Overlay` is the unstyled primitive backdrop and does not animate yet
(planned).

<!-- tokens:start (generated by `pnpm exec tsx packages/tokens/scripts/generate.ts`; do not edit by hand) -->
## Tokens

Set these on any element above the component (a theme scope, a design
system scope or `data-tx-scope`); each defaults to the system or theme token
shown, so nothing changes until one is set. The full list, with the exact
read expressions, is in
[tokens-components](../../tokens/docs/tokens-components.md#component-tokens).

| Token | Default | Meaning |
| --- | --- | --- |
| `--tx-sheet-z-index` | `var(--tx-z-overlay)` | Stacking. |
| `--tx-sheet-gap` | `var(--tx-space-4)` | Gap between header, body and footer. |
| `--tx-sheet-padding` | `var(--tx-space-5)` | Padding. |
| `--tx-sheet-border-width` | `var(--tx-border-width-thin)` | Border width. |
| `--tx-sheet-elevation` | `var(--tx-elevation-4)` | Shadow. |
| `--tx-sheet-font-size` | `var(--tx-font-size-sm)` | Body font size. |
| `--tx-sheet-line-height` | `var(--tx-type-body-line)` | Body line height. |
| `--tx-sheet-title-font-size` | `var(--tx-type-heading-size)` | Title font size. |
| `--tx-sheet-title-font-weight` | `var(--tx-type-heading-weight)` | Title font weight. |
| `--tx-sheet-title-line-height` | `var(--tx-type-heading-line)` | Title line height. |
| `--tx-sheet-scrim-opacity` | `var(--tx-opacity-scrim)` | Foreground mix of the overlay scrim. |

<!-- tokens:end -->
