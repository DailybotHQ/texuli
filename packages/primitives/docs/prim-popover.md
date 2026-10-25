# Popover

`@texuli/primitives/popover` exports four compound Svelte parts: `Root`, `Trigger`, `Content` and `Close`.

```svelte
<script lang="ts">
import { Close, Content, Root, Trigger } from '@texuli/primitives/popover';

let open = $state(false);
</script>

<Root bind:open side="bottom" align="start" sideOffset={6}>
  <Trigger>Filters</Trigger>
  <Content aria-label="Filter tasks">
    <label><input type="checkbox" /> Assigned to me</label>
    <Close>Apply</Close>
  </Content>
</Root>
```

The default popover is non-modal: outside pointer or focus interactions dismiss it, Escape restores focus to the trigger, and opening moves focus to the first control. Set `modal` on `Root` to make outside content inert, trap focus and lock scrolling. Use `open` with `bind:open` and `onOpenChange` for controlled state. `Content` is anchored to its `Trigger`; `side`, `align` and `sideOffset` configure placement. Set `positioning={false}` when a host owns placement.

Parts expose state through `data-state`; `Trigger` supplies the dialog relationships and `Content` uses the native manual popover top layer when supported, with the overlay engine's stacking fallback in older browsers. Closed content is unmounted. The primitive is headless and leaves visual styling to the consumer.

## Initial focus

`Popover.Content` takes `initialFocus`: an element inside the content, or a function returning one, focused when the popover opens. A date picker can pass the selected day. When it resolves to nothing focusable (or to an element outside the content), the usual behavior applies: the first control, else the content (a modal popover prefers an `[autofocus]` element). It accepts the same type as `Dialog`'s `initialFocus`.

```svelte
<Popover.Content initialFocus={() => grid?.querySelector('[aria-selected="true"]') ?? null}>…</Popover.Content>
```

