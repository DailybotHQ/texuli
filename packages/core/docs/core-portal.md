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

## Token scopes (ADR-023)

A theme or design system applied to an element (`applyTheme(el)` from
`@texuli/tokens`) marks it `[data-tx-scope]` and writes its `--tx-*` custom
properties inline. Content moved to `body` would leave that subtree and lose
its theme. `createPortal` itself never looks for a scope (its default stays
`body`); `createScopedPortal` adds scope following, so only the overlays that
portal pay for it:

- **Scope resolution.** `findPortalScope(node)` returns the nearest
  `[data-tx-scope]` or `[data-tx-theme]` element (itself included). It
  returns `null` with no scope, and when the scope already holds `body` (a
  page-wide theme on `<html>`, which body content inherits anyway). Inside a
  scoped portal root it returns the scope that root mirrors, so a nested
  overlay mirrors the scope rather than the root.
- **Scoped portal root.** `createScopedPortalRoot(scope)` appends a
  `div[data-tx-portal-root]` to `body`, styled `display: contents` (no box,
  so it paints nothing and positions nothing). It mirrors the scope's
  `data-tx-*` attributes (except the `data-tx-portal*` and `data-tx-overlay`
  markers) and its inline custom properties (`--*`). A `MutationObserver` on
  the scope's attributes keeps it in sync; `destroy()` disconnects the
  observer and removes the root. Ordinary inline properties, `id`, `class`
  and other attributes are not copied, so a scope themed only through a class
  rule is not followed: give it `data-tx-*` attributes or inline variables,
  or pass a target.
- **`createScopedPortal(source, { target, scope })`.** With no `target` (or
  `null`), the source goes to the portal root of its scope (created on
  demand, removed once the source leaves it), or to `body` without one. An
  explicit `target` wins and nothing is mirrored. `scope` is `'auto'`
  (default: the nearest scope of the source's original position), an
  element, a function returning one, or `null` (always `body`). It is
  resolved on every placement, so a theme applied after the portal was
  created is followed by the next `setTarget`.
- **Hooks.** `createPortal` accepts `fallback(origin)` (where an omitted or
  `null` target goes, asked on each placement with the source's original
  parent) and `settled(parent)` (after each placement and at destroy);
  `createScopedPortal` is built on them. The overlay engine takes
  `createScopedPortal` as its `portal` feature to follow scopes too.

```ts
import { createScopedPortal } from '@texuli/core/portal';

const portal = createScopedPortal(dialogWrapper); // follows the nearest [data-tx-scope]
portal.setTarget(null); // place again: picks up a scope applied since
const bodyOnly = createScopedPortal(other, { scope: null }); // opt out
```

`PORTAL_ROOT_ATTRIBUTE`, `SCOPE_ATTRIBUTE` and `SCOPE_SELECTOR` are exported.
Tests: `packages/core/tests/portal-scope.test.ts`; browser check:
`tests/e2e/theme-scopes.spec.ts`.
