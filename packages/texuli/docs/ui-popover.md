# Popover and HoverCard

**Package:** `texuli`  
**Source:** `packages/texuli/src/components/popover/`  
**Primitives:** `@texuli/primitives/popover`, `@texuli/primitives/hover-card`  
**Tests:** `packages/texuli/tests/overlays.test.ts`  
**Examples:** `ui-popover`, `ui-popover-variants`, `ui-popover-states`, `ui-popover-rtl`, `ui-popover-dark`

Styled floating surfaces with an arrow, on the `--tx-*` token contract.

## Popover

```svelte
<script lang="ts">
  import { Popover } from 'texuli/popover';
  let open = $state(false);
</script>

<Popover.Root bind:open side="bottom" align="center">
  <Popover.Trigger>Account</Popover.Trigger>
  <Popover.Content aria-label="Account menu" variant="elevated" size="md">
    <p class="tx-popover__title">Marta Ruiz</p>
    <p class="tx-popover__description">marta@example.com</p>
    <Popover.Close>Close</Popover.Close>
  </Popover.Content>
</Popover.Root>
```

| Prop (Content) | Values |
| --- | --- |
| `variant` | `elevated` (default), `flat` |
| `size` | `sm`, `md`, `lg` |
| `arrow` | boolean (default true) |

Root also accepts primitive props: `open`, `modal`, `side`, `align`, `sideOffset`, `onOpenChange`.

## HoverCard

```svelte
<script lang="ts">
  import { HoverCard } from 'texuli/popover';
</script>

<HoverCard.Root openDelay={200} closeDelay={150}>
  <HoverCard.Trigger>Jordan Lee</HoverCard.Trigger>
  <HoverCard.Content aria-label="Jordan Lee">
    <p class="tx-hover-card__title">Jordan Lee</p>
    <p class="tx-hover-card__description">example.com</p>
  </HoverCard.Content>
</HoverCard.Root>
```

`HoverCard.Content` requires an `aria-label`. Open/close delays come from the primitive.

## Rules

- Logical CSS only (`inline-size`, `inset-block`, …)
- No static `style=` attributes
- Layers: `@layer tx.components`
- Links inside content must use `safeHref` / Button URL policy

## Motion

`motion` on `Popover.Content` (scale in and out) and `HoverCard.Content`
(scale in, fade out), quick (`fast`), through `@texuli/core/motion`
([ui-motion](ui-motion.md)). A closing card stays shown, inert, while its
exit plays.
