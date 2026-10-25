# Core portal

`createPortal(source, options?)` moves an existing DOM element to a target
element or, by default, the source element's owner document body. It returns a
controller with `setTarget`, `destroy`, `currentTarget` and `isPortaled`.
`currentTarget` is the current element parent, or `null` when the parent is not
an element.

```ts
import { createPortal } from '@texuli/core';

const portal = createPortal(dialogElement);
portal.setTarget(deviceFrameElement); // update when the frame target changes
portal.setTarget(null); // clear the custom target and use the document body
portal.destroy(); // restore the exact original sibling position
```

The source element itself moves; Texuli does not clone it or create a wrapper.
That preserves the element's identity, event listeners, descendants and
framework-owned state. An origin comment records its insertion point while it
is portaled, so moving to another target does not lose the original order.
Destroy is idempotent and restores the element before that comment. If the
source started detached, destroy detaches it again.

Portal code does not read `window` or `document` at module initialization and
does not use ambient browser globals. It derives the document from the explicit
source element. If there is no source, or no body exists yet, it leaves the
existing DOM unchanged. That keeps the helper safe to import during SSR and
preserves server-rendered output until a client target exists. Targets must be
elements from the source's owner document; cross-document moves and moving an
element into itself or a descendant fail with `false` and leave the source in
place.

`setTarget` is the reactive seam: a UI binding calls it whenever its target
element changes. Passing `null` or `undefined` selects `ownerDocument.body`.
When the controller is destroyed, later updates return `false`.

The core package owns only the DOM move and restoration mechanics. A Svelte
wrapper can keep component context and reactive state in its normal component
tree while using this controller to move the rendered host element.
