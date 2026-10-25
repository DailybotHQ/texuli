# Texel: inert outside, with an exemption registry

**Package:** `@texuli/core` · **Path:** `src/inert/` · **Task:** T-core-inert

While a modal layer is open, everything outside it becomes `inert`: no focus,
no pointer interaction, out of the accessibility tree. Regions that must stay
reachable anyway (the toast region, the live announcer) register as
**exemptions** and are never made inert, even when they sit outside the modal.
Closing the modal restores every attribute exactly. Modal scopes nest.

## Why

A modal that leaves the page behind it focusable lets Tab and screen-reader
virtual cursors escape the dialog. Making "everything else" inert fixes that,
but the naive version also silences a toast that says "Saved" or an announcer
that reads a status, because they live outside the dialog (R16). The registry
lets those regions opt out once, page-wide, whichever island mounted them.

## Public API

| Export | Role |
| --- | --- |
| `createInertRegistry()` | Isolated registry (unit tests, an isolated app root). |
| `getInertRegistry(globalObject?)` | Page-wide registry on `globalThis` (default) or a test fake. |
| `resetInertRegistry(globalObject?)` | Restore everything and drop the shared instance (tests). |
| `INERT_REGISTRY_GLOBAL_KEY` | `__TEXULI_INERT_REGISTRY_V1__`. Bump only on a breaking shape. |
| `registry.exempt({ element, label? })` | Keep a region reachable under every current and future scope. Returns `{ release }`. |
| `registry.inertOutside(layer, { root?, ariaHidden?, observe?, label? })` | Open a modal scope. Returns `{ release, isActive }`. |
| `registry.refresh()` | Recompute after the DOM under the scope's root changed. |
| `registry.size()` / `inertElements()` / `exemptions()` / `isExempt(el)` | Inspect state. |
| `registry.clear()` | Close every scope, drop every exemption, restore every attribute. |
| `computeInertTargets(root, keep)` | Pure: the elements to make inert so only `keep` stays live. Writes nothing. |

```ts
import { getInertRegistry } from '@texuli/core';

const inert = getInertRegistry();

// Once, wherever the toast region mounts:
const toastExemption = inert.exempt({ element: toastRegionEl, label: 'toast-region' });

// When the dialog opens (after it is in the DOM):
const scope = inert.inertOutside(dialogEl, { label: 'dialog' });

// When it closes:
scope.release();
```

## Behavior

- **What becomes inert.** Starting at `root` (default: the layer's
  `ownerDocument.body`), each child is left alone if it is the layer or an
  exemption, descended into if it *contains* one, and made inert otherwise. The
  ancestors of the layer and of every exemption are never made inert, which is
  what keeps an exemption outside the modal reachable. Non-rendered elements
  (`script`, `style`, `template`, `link`, `meta`, `noscript`, `base`, `title`,
  `head`) are skipped.
- **Only the topmost scope decides.** Opening a second modal makes the first
  one inert too (it is outside the new top layer). Closing the top scope
  re-applies the one below. Closing a lower scope first changes nothing until
  the top closes.
- **Exact restore.** The first time the texel touches an element it records the
  element's `inert` and `aria-hidden` values; when the element leaves the inert
  set it gets those values back. An element the author already made inert is
  left exactly as written and stays inert after close. Only the attributes that
  must change are written, so nested scopes do not toggle shared elements off
  and on.
- **Exemptions are live.** Registering or releasing an exemption while a scope
  is open recomputes immediately, including an exemption deep inside a region
  that was inert (the inert marks move down to its siblings).
- **`ariaHidden: true`** also sets `aria-hidden="true"` on inert elements, for
  assistive tech that predates `inert`. It is per scope: a nested scope
  without it restores the author's `aria-hidden` on the elements it shares.
- **DOM changes.** Content appended after the scope opened (a late portal) is
  not inert until `refresh()`, or automatically with `observe: true`, which
  watches the root's subtree with `MutationObserver` (childList only) while
  that scope is the top one. Without `MutationObserver` the option does
  nothing.
- **SSR.** Nothing runs at import time. A scope takes its layer explicitly and
  the shared registry is created on first `getInertRegistry()` call.

## Combine with the layer stack

The layer stack (`core-layer-stack.md`) decides *who receives Escape and
outside clicks*; this texel decides *what outside is reachable at all*. A modal
primitive registers in both and releases both on close; a non-modal popover
registers only in the layer stack.

## Verified

- `pnpm vitest run packages/core/tests/inert.test.ts`: 24 tests (pure target
  computation, exemptions, exact restore including author-set attributes,
  nesting in and out of order, live exemptions, `refresh`, `observe`, the
  shared registry). Six deliberate mutations of the implementation each fail
  at least one test.
- A real-browser probe (Chromium and WebKit through Playwright, 2026-10-23):
  under a scope, `focus()` and a real mouse click do not reach outside content,
  the exempt toast button still takes focus, and after `release()` the outside
  is focusable again with no `inert` attribute left. The probe is a one-off
  script, not a committed e2e spec.

## Limits

- Light DOM only: content inside shadow roots under `root` is made inert with
  its host (the host is a child like any other); an exemption inside a shadow
  root is not found by `contains` and should be registered by its host.
- One `root` per scope. Content outside the root is never touched.
- Native `<dialog>.showModal()` already inerts the page in browsers; this texel
  is for custom modal layers, and is what keeps exemptions reachable.
