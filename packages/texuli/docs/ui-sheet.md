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
`Description`, and `Close` parts. Content accepts a `size` (`sm`, `md`, `lg`,
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

## Non-modal dismissal (FIX-sheet-dismiss-outside)

`DetailPanel.Content` and a non-modal `Sheet.Content` (`modal={false}`)
forward `dismissOutside` and `closeOnEscape` to the primitive. Both default
to `false`.
- `dismissOutside` closes the panel on an outside press or outside focus;
  the trigger never counts.
- `closeOnEscape` closes it on Escape anywhere on the page.

`Drawer` is always modal, so they have no effect there. The catalog
manifests list them as host props.
