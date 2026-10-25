# Texel: outside interaction (pointer vs focus)

**Package:** `@texuli/core`  
**Path:** `packages/core/src/dismiss/`  
**Task:** T-core-dismiss

Framework-free helpers that distinguish **pointer-outside** from **focus-outside**
for dismissable layers. Builds on the dismissable-layer stack
(`T-core-layer-stack`) when nested layers need topmost-only delivery.

## API

```ts
import {
  bindDismissLayer,
  createOpenGestureGuard,
  isFocusOutside,
  isPointerOutside,
  isTargetOutside,
  type DismissOutsideEvent,
} from '@texuli/core';
```

| Export | Role |
| --- | --- |
| `isTargetInside` / `isTargetOutside` | Containment with optional `composedPath` and `branches` |
| `isPointerOutside` | Outside + primary button / touch / pen |
| `isFocusOutside` | Outside for a `focusin` target |
| `pointerModalityOf` | `'mouse' \| 'touch' \| 'pen' \| 'unknown'` |
| `createDismissOutsideEvent` | Preventable wrapper (`preventDefault` = layer veto) |
| `createOpenGestureGuard` | Pure guard for the opening pointer/click |
| `bindDismissLayer({ element, document, … })` | Document listeners; `noteOpenGesture` + `disconnect` |

## bindDismissLayer

```ts
const stack = getLayerStack();
const layer = stack.register({ element: panel });

const dismiss = bindDismissLayer({
  element: panel,
  document,
  stack,
  layerId: layer.id,
  branches: [triggerEl],
  pointerPhase: 'pointerdown', // or 'click' for touch-friendly dismiss
  onPointerOutside: (event) => {
    if (event.pointerType === 'touch') {
      /* optional: defer */
    }
    if (shouldKeepOpen) {
      event.preventDefault();
      return;
    }
    close();
  },
  onFocusOutside: (event) => {
    if (focusMovesToDatePicker) {
      event.preventDefault();
      return;
    }
    close();
  },
});

// When opening from a pointer on the trigger:
dismiss.noteOpenGesture(openingPointerDownEvent);

// teardown
dismiss.disconnect();
layer.unregister();
```

### Contracts

- **Document is required** — no `window`/`document` at import time.
- **Pointer vs focus** — separate callbacks; focus uses capture `focusin`.
- **Preventable** — `DismissOutsideEvent.preventDefault()` sets
  `defaultPrevented` so the layer can veto dismiss (and cancels the DOM event
  when it is cancelable).
- **Touch and pen** — same outside path as mouse; non-primary mouse buttons
  never count as dismiss pointers.
- **Open-gesture guard** — `noteOpenGesture(event?)` ignores the opening
  pointer id through its click, or skips the next outside pointerdown after a
  programmatic open.
- **Topmost only** — with `stack` + `layerId`, lower layers stay silent.
- **Branches** — trigger buttons and twin portal roots count as inside.
- **`pointerPhase: 'click'`** — wait for click after an outside pointerdown
  (drag-friendly on touch).

## Relation to the layer stack

`bindLayerStackDocument` still routes Escape and a coarse pointerdown. Prefer
`bindDismissLayer` when a surface needs focus-outside, open-gesture guarding,
branches, or click-phase pointer outside. Both may share the same
`LayerStack` instance.

## Testing

```bash
pnpm vitest run packages/core/tests/dismiss.test.ts
```

## Size

`@texuli/core/dismiss` measures 1,582 B gzip (`pnpm size`, 2026-10-24), within the
4 KiB budget for a texel subpath. The `@texuli/core` root barrel, which re-exports every texel, measures 22,972 B of its 24,576 B budget.
