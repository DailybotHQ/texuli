# Texel: dismissable-layer stack

**Package:** `@texuli/core` · **Path:** `src/layer-stack/` · **Task:** T-core-layer-stack

One ordered registry for every dismissable surface on the page (dialog, menu,
popover, select). Nested layers and separate Svelte islands share the same
stack through a versioned `globalThis` key. **Escape** and **outside pointer
interaction** are offered only to the **topmost** layer.

## Why

Floating UI needs a single z-order of "who owns dismiss right now". Without a
shared stack, two islands each open a dialog and both handle Escape, or a menu
inside a dialog closes the dialog first. The stack is framework-free so L1
primitives and any future custom element bind the same rules.

## Public API

| Export | Role |
| --- | --- |
| `createLayerStack()` | Isolated stack (unit tests, storybook roots). |
| `getLayerStack(globalObject?)` | Page-wide singleton on `globalThis` (default) or a test fake. |
| `resetLayerStack(globalObject?)` | Drop the shared instance (tests). |
| `LAYER_STACK_GLOBAL_KEY` | `__TEXULI_LAYER_STACK_V1__` — bump only on a breaking shape. |
| `stack.register({ element, id?, label? })` | Push (or re-raise by id). Returns `{ id, unregister, isTop, order }`. |
| `stack.unregister(id)` / `stack.clear()` | Remove one or all. |
| `stack.list()` / `top()` / `isTop(id)` / `orderOf(id)` / `size()` | Inspect order (list is bottom → top). |
| `decideEscape(stack, event)` | `{ layerId }` for the top layer on Escape, else `null`. |
| `layerReceivesEscape(stack, id)` | Whether that id is top. |
| `isPointerOutsideTopLayer(stack, target, { composedPath? })` | Containment helper. |
| `layerReceivesOutsideInteraction(stack, target, opts?)` | `{ layerId }` of the top layer when the target is outside it. |
| `bindLayerStackDocument(document, stack, handlers?)` | Optional document listeners; `disconnect()` tears them down. |

```ts
import {
  bindLayerStackDocument,
  getLayerStack,
} from '@texuli/core';

const stack = getLayerStack();
const layer = stack.register({ element: panelEl, label: 'dialog' });

const binding = bindLayerStackDocument(document, stack, {
  onEscape: (top, event) => {
    if (top.id !== layer.id) return;
    event.preventDefault();
    closeDialog();
    return true;
  },
  onPointerOutside: (top) => {
    if (top.id !== layer.id) return;
    closeDialog();
    return true;
  },
});

// on destroy:
layer.unregister();
binding.disconnect();
```

## Contracts

- **No DOM at import time.** Creating a stack does not read `window` or
  `document`. `getLayerStack()` only writes the global key when called.
- **Topmost only.** Lower layers never receive Escape or outside pointer from
  these helpers while a higher layer is registered.
- **Re-register by id** moves that layer to the top (raise).
- **Unregister is idempotent.**
- **Focus-outside vs pointer-outside** is refined by the dismiss texel
  (`T-core-dismiss`). This stack only routes pointerdown in
  `bindLayerStackDocument`.
- **Inert outside** and toast exemptions (`R16`) are separate texels
  (`T-core-inert`). The stack does not set `inert`.

## Testing

```bash
pnpm vitest run packages/core/tests/layer-stack.test.ts
```

## Size

`@texuli/core/layer-stack` measures 1,201 B gzip (`pnpm size`, 2026-10-24), within the
4 KiB budget for a texel subpath. The `@texuli/core` root barrel, which re-exports every texel, measures 22,972 B of its 24,576 B budget.
