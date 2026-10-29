# `@texuli/drag` — interaction, accessibility and i18n contract

**Status: in development** (PLAN_007, [ADR-007](../../../docs/DECISIONS.md)).
Every surface built on `@texuli/drag` meets this contract: the
`@texuli/primitives/sortable` binding, `@texuli/workflows`, the
`@texuli/data` board, tree view, calendar, timeline and grid column moves,
the `@texuli/player` shared drag scope for `sortable-list` nodes, and the
texuli.com builder outline. The package is on npm as `0.7.0` (in
development); the integrations above ship from the `0.4.0` release of each
consuming package. The engine is general purpose: strategies,
collisions, modifiers and messages are pluggable, so a new surface composes
these pieces instead of forking the engine.

## Interaction kinds

| Kind | Examples | Owner |
| --- | --- | --- |
| OS file drop | dropping files from the desktop | `@texuli/primitives/file-drop`, `texuli/file-upload` (unchanged, not this package) |
| Continuous gestures | slider, splitter, column resize, scrub, crop, pan/zoom | `@texuli/drag/gesture` |
| Sortable | lists in every axis, boards, nested lists, trees, grid columns | `@texuli/drag/sortable` |
| Spatial | free placement on a canvas, snapping, marquee | `@texuli/drag/spatial` |
| Graph editing | nodes, ports, edges | `@texuli/drag/graph`, `@texuli/workflows` |

## Keyboard

- Space or Enter on a handle picks the item up; arrow keys move it (left and
  right flip in right-to-left text); Space or Enter drops; Escape cancels,
  restores the original position and keeps focus on the item; Tab cancels.
- Existing surface shortcuts stay (Alt+Arrow in the tree view, Ctrl+Arrow in
  the calendar).
- The engine consumes **intents** (`pickUp`, `movePrev`, `moveNext`,
  `moveInto`, `moveOut`, `drop`, `cancel`); bindings map keys to intents with
  `@texuli/core/keyboard`.
- Every pointer drag has a non-drag alternative (WCAG 2.5.7), such as a
  "Move to…" menu.
- Graph surfaces: arrows move focus spatially to the nearest node,
  Alt+Arrow nudges one grid step, Enter on a port starts connect mode (arrows
  cycle compatible ports, Enter connects, Escape cancels), Delete removes,
  Ctrl+Z / Ctrl+Y undo and redo, Ctrl+= / Ctrl+- zoom, 0 fits. A treegrid
  outline edits the graph without the canvas.

## ARIA and targets

- Handles are buttons with `aria-describedby` instructions and a localized
  `aria-roledescription`. Containers keep their WAI-ARIA pattern role
  (listbox, tree, grid).
- No `aria-grabbed` or `aria-dropeffect` (deprecated).
- Handles and ports meet the 24 by 24 CSS pixel target size (WCAG 2.5.8).

## Announcements and i18n

- Announcements go to a polite live region through the caller's `announce`
  (`@texuli/core/announcer` in the bindings). During a pointer drag, only a
  change of target is announced, debounced.
- Every string comes from `DragMessages` templates (`pickedUp`, `moved`,
  `dropped`, `cancelled`, `refused(reason)`) with position, total and
  container. English defaults ship; any locale overrides them through
  `resolveDragMessages()`. No surface hardcodes English.

## Pointer, motion and layout

- Pointer Events only (mouse, pen, touch); `touch-action: none` on handles
  only; pointer capture with a fallback; a 4 px threshold; `pointercancel`
  cancels; optional long-press on touch.
- Auto-scroll of the nearest scrollable ancestors.
- `prefers-reduced-motion` disables move and drop animations, not
  auto-scroll. Forced colors keep handles, drop indicators and focus visible.
- Rects are snapshotted at drag start and re-measured only on scroll (no
  layout thrash).

## Constraints, history and safety

- Axis lock, bounds and snap-to-grid are modifiers;
  `canDrop(source, target)` returns `{ ok: true }` or `{ ok: false, reason }`;
  locked items cannot move or be displaced.
- The engine emits move operations; the host owns history (undo and redo).
- SSR-safe: no `window` or `document` access at module load; bindings attach
  inside effects.
- Item and node content is text; links and images pass the URL policy at the
  `untrusted` tier. Nothing is rendered as HTML.

## Performance

- Move processing and collision for a 1,000-item sortable, and layout plus
  moves for a 500-node workflow, stay within the limits in `tests/perf`
  (`pnpm test:perf`). Every subpath stays within its size budget.
