# Overlay core (per-feature overlay engine)

**Package:** `@texuli/core` · **Import:** `import { createOverlayCore } from '@texuli/core/overlay-core'`

`createOverlayCore(options, features)` is the overlay engine with **opt-in features**.

**Always included:**
- layer stack registration;
- Escape, outside-pointer and outside-focus dismissal, for the topmost layer only, with branches and exemptions;
- presence (enter and exit motion);
- the R16 top-layer re-show of exempt popovers;
- the focus rescue on close.

**Opt-in features:** each is the texel's own function, passed in `features`, so a primitive bundles only what it uses.

| Feature | Texel | Needed for |
| --- | --- | --- |
| `position` | `positionFloating` (`@texuli/core/position-dom`) | `anchor`, `setAnchor()` |
| `focusScope` | `createFocusScope` (`@texuli/core/focus-scope`) | `trapFocus` (default with `modal`) |
| `inert` | `getInertRegistry` (`@texuli/core/inert`) | `inertOutside` (default with `modal`) |
| `scrollLock` | `lockScroll` (`@texuli/core/scroll-lock`) | `lockScroll` (default with a top-layer `modal`) |
| `portal` | `createPortal` (`@texuli/core/portal`) | `portal`, a `contained` `container` |

**Missing features fail loudly.** An option that needs a feature you did not pass throws a `TypeError` naming it, at creation, or at `setAnchor()`. A misconfigured primitive cannot silently lose its focus trap.

**Inside modals.** An overlay without the `inert` feature still exempts itself while a modal has made the page inert. It uses the page-wide registry the modal created (read from `globalThis`, not imported), so a tooltip or menu opened inside a dialog stays live. When no modal exists, no registry is touched.

`createOverlay(options)` (`@texuli/core/overlay`) keeps its API: it is `createOverlayCore` with `ALL_OVERLAY_FEATURES`. The feature table is marked pure, so importing the module without calling `createOverlay` adds nothing.

## Who uses what (`pnpm size`, gzip)

"Before" and "After" are from when overlay-core landed; the last column is
`pnpm size` on 2026-10-24.

| Entry | Features | Before | After | 2026-10-24 |
| --- | --- | ---: | ---: | ---: |
| `@texuli/primitives/tooltip` | position | 14.79 KiB | **11.21 KiB** | 12.10 KiB |
| `@texuli/primitives/popover` | position; focusScope, inert, scrollLock load lazily for `modal` | 14.35 KiB | 14.38 KiB | 11.88 KiB (+4.37 KiB lazy) |
| `@texuli/primitives/menu` (new) | position | — | 15.46 KiB | 16.47 KiB |
| `@texuli/core/overlay-core` (new) | none | — | 5.00 KiB | 5.08 KiB |
| `@texuli/core/overlay` | all | 12.60 KiB | 12.87 KiB | 13.64 KiB |

A Dialog should pass `focusScope`, `inert` and `scrollLock`, and **not** `position`.

## Tests

`packages/core/tests/overlay-core.test.ts` (13 tests):
- each missing feature throws, and `setAnchor` without `position` throws;
- Escape works with no features;
- a position-only overlay works;
- a non-modal overlay stays exempt inside a modal without `inert`;
- no registry is created without a modal;
- a modal works with its three features;
- `ALL_OVERLAY_FEATURES` is complete.

`packages/core/tests/overlay.test.ts` (25) still passes through `createOverlay`.
