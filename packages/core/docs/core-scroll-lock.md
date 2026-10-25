# Scroll lock

`lockScroll(document)` locks the page while a modal layer is open and returns
an idempotent function that releases that lock. Pass the owning document so
iframes are handled independently and importing Texuli remains safe during
server rendering.

```ts
import { lockScroll } from '@texuli/core';

const unlock = lockScroll(dialog.ownerDocument);
// When the modal closes:
unlock();
```

## Behavior

- Scroll locking is reference-counted per `Document`. Nested dialogs keep the
  page locked until each acquired lock has been released.
- The document root and body receive temporary overflow locks, and the root
  gets `overscroll-behavior: none` to prevent scroll chaining.
- When a classic scrollbar consumes viewport width, the body receives matching
  logical `padding-inline-end`. A computed `scrollbar-gutter: stable` already
  reserves that space, so the helper avoids adding a second gutter.
- On iOS and touch-capable iPadOS, the body is fixed at the captured vertical
  scroll offset to prevent rubber-band page scrolling. The saved window scroll
  position is restored after the last lock is released.
- Every changed inline style value and priority is restored to its exact prior
  state. Releasing the same cleanup function more than once has no effect.

When the document has no body yet, the function returns a no-op cleanup. The
helper does not lock scrolling inside the modal; its scrollable content should
use its own overflow behavior and contain overscroll where appropriate.

## Boundaries

The scrollbar width is measured from the explicit document's window and root
client width. Overlay scrollbars need no compensation. Browser-specific iOS
behavior is tested through the DOM seam but still warrants real-device
verification in the overlay browser suite.
