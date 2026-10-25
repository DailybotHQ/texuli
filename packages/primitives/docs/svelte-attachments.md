# Svelte attachments for primitives

`@texuli/primitives` keeps framework-free behavior in `@texuli/core` and binds it to Svelte 5 with attachments. Each attachment owns the resources created for its node and returns an idempotent cleanup through Svelte's attachment lifecycle.

## Attachments

Use `attachFocusScope`, `attachDismissLayer`, `attachRovingFocus`, and `attachPosition` for the matching core texel. `attachOverlay` is the composed floating-layer binding: it creates one core overlay controller, gives the controller to the primitive, and destroys it when the node detaches. Attachments do not read `window` or `document` at module initialization; document-dependent bindings use the attached node's `ownerDocument`.

```svelte
<script lang="ts">
  import { attachFocusScope } from '../src/internal/index.ts';

  const focusScope = attachFocusScope();
</script>

<section {@attach focusScope} aria-label="Dialog content">
  <!-- focusable content -->
</section>
```

Roving focus uses descendants with `data-roving-item` by default. Pass an `items(root)` callback for a different item model. It synchronizes `tabindex`, listens for key and focus changes, watches item and disabled-state changes, and removes listeners and restores the original `tabindex` values on detach.

## Child snippet contract

A trigger can accept `child?: ChildSnippet<Props>` and render it with `{@render child?.({ props })}`. The snippet places `props` on its root element. `composeChildProps(primitiveProps, childProps)` joins classes, calls the consumer event handler first, and skips primitive behavior when that handler prevents the event. Primitive state and trigger accessibility attributes remain authoritative.

```svelte
<script lang="ts">
  import type { ChildSnippet } from '../src/internal/index.ts';

  let { child, open, onOpenChange }: {
    child?: ChildSnippet<{ 'aria-expanded': string; onclick: (event: MouseEvent) => void }>;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  } = $props();
  const props = $derived({ 'aria-expanded': String(open), onclick: () => onOpenChange(!open) });
</script>

{@render child?.({ props })}
```

## Context and state

`createPrimitiveContext<Value>(name)` returns typed `get()` and `set(value)` helpers backed by Svelte context. Calling `get()` outside its provider throws an error naming the missing provider. `stateAttributes(state, disabled)` standardizes `data-state` and emits the empty `data-disabled` attribute only when disabled.

The internal helpers are package implementation details; primitives should import them through `src/internal/index.ts`, not as a cross-package public API.
