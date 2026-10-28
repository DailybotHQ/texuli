# `@texuli/drag` capability parity

The SortableJS-class capability matrix for `@texuli/drag` (PLAN_007,
T-drag-engine). Each row names its test in
[`tests/parity.test.ts`](../tests/parity.test.ts), which runs one focused
check per row; the last test in that file fails when this table and the
tests drift apart. Deeper coverage per subpath is in the files in the last
column.

Status: **in development** (on npm as `0.3.0`, pre-1.0). The package
is framework-free; the Svelte binding is `@texuli/primitives/sortable`.

| Capability | Parity test | Subpath | Deeper tests |
| --- | --- | --- | --- |
| Session state machine: idle → pressed → dragging → dropping → idle | `session state machine` | `.` | `session.test.ts` |
| Lifecycle events: start, move, over, drop, cancel, add, remove, update | `lifecycle events` | `.`, `sortable` | `session.test.ts`, `sortable-controller.test.ts` |
| Refusal reasons on pick-up, move and drop | `refusal reasons` | `.` | `session.test.ts`, `sortable.test.ts` |
| Vertical lists | `vertical list` | `sortable` | `sortable-controller.test.ts` |
| Horizontal lists, read right to left in RTL | `horizontal list (LTR and RTL)` | `sortable` | `sortable-controller.test.ts` |
| Grid (wrapping) lists | `grid list` | `sortable` | `sortable-controller.test.ts` |
| Multi-container groups | `multi-container groups` | `sortable` | `sortable.test.ts` |
| Group `pull` / `put` rules (boolean, group list, function) | `pull and put rules` | `sortable` | `sortable.test.ts` |
| Clone on pull (`pull: 'clone'`, custom clone ids) | `clone on pull` | `sortable` | `sortable.test.ts`, `sortable-controller.test.ts` |
| Nested lists (innermost list wins) | `nested lists` | `sortable` | `sortable-controller.test.ts` |
| Tree reparent: keyboard `moveInto` / `moveOut`, pointer nest zone, cycle and depth guards | `tree reparent` | `sortable` | `sortable.test.ts`, `sortable-controller.test.ts` |
| Swap mode (same list and across lists) | `swap mode` | `sortable` | `sortable.test.ts`, `sortable-controller.test.ts` |
| Multi-item drag (a selection moves as one block) | `multi-item drag` | `sortable` | `sortable.test.ts`, `sortable-controller.test.ts` |
| Drag handles | `handles` | `sortable` | `sortable-controller.test.ts` |
| Filters (items that never drag) | `filters` | `sortable` | `sortable.test.ts` |
| Locked items (never move, keep their index) | `locked items` | `sortable` | `sortable.test.ts`, `sortable-controller.test.ts` |
| Sort disabled per list and `maxItems` capacity | `sort disabled and capacity` | `sortable` | `sortable.test.ts` |
| Collision: closest center | `collision closestCenter` | `collision` | `collision.test.ts` |
| Collision: pointer within (smallest wins) | `collision pointerWithin` | `collision` | `collision.test.ts` |
| Collision: rect intersection | `collision rectIntersection` | `collision` | `collision.test.ts` |
| Collision: midpoint index (binary search) | `collision midpointIndex` | `collision` | `collision.test.ts` |
| Modifier: axis lock | `modifier axis lock` | `modifiers` | `collision.test.ts` |
| Modifier: bounds | `modifier bounds` | `modifiers` | `collision.test.ts` |
| Modifier: snap to grid | `modifier snap-to-grid` | `modifiers` | `collision.test.ts` |
| Auto-scroll: edge zones, speed curve, caller-supplied frame loop | `auto-scroll edge zones and speed curve` | `auto-scroll` | `auto-scroll.test.ts` |
| Pointer tracker with pointer capture and a document fallback | `gesture tracker with capture fallback` | `gesture` | `gesture.test.ts` |
| 4 px drag threshold (clicks stay clicks) | `4 px threshold` | `gesture`, `.` | `gesture.test.ts`, `session.test.ts` |
| `pointercancel` is a cancel, never a drop | `pointercancel cancels` | `gesture` | `gesture.test.ts` |
| Optional long-press (touch by default) | `long-press` | `gesture` | `gesture.test.ts` |
| Canvas pan and zoom transforms | `spatial pan and zoom transforms` | `spatial` | `spatial.test.ts` |
| Free placement under zoom | `spatial free placement` | `spatial` | `spatial.test.ts` |
| Snapping and alignment guides | `spatial snapping and guides` | `spatial` | `spatial.test.ts` |
| Marquee selection | `spatial marquee` | `spatial` | `spatial.test.ts` |
| Resize with min/max, bounds, grid and aspect ratio | `spatial resize bounds` | `spatial` | `spatial.test.ts` |
| Graph port hit-testing | `graph port hit-testing` | `graph` | `graph.test.ts` |
| Graph edge hit areas | `graph edge hit areas` | `graph` | `graph.test.ts` |
| Graph connection rules (direction, self, type, duplicate, capacity, cycle) | `graph connection rules` | `graph` | `graph.test.ts` |
| `DragMessages` templates with position, total and container; `resolveDragMessages()` | `messages with position, total and container` | `messages` | `messages.test.ts` |
| Keyboard intents, inline arrows flipped in RTL | `keyboard intents with RTL` | `sortable` | `sortable.test.ts` |
| Pluggable collision, slot strategy, modifiers and messages | `pluggable strategies` | all | `sortable-controller.test.ts` |
| Rects snapshotted at drag start, re-measured on scroll only | `rect snapshot, re-measured on scroll only` | `sortable` | `sortable-controller.test.ts` |
| Overlay (`delta`) and in-place (`move.next`) previews | `overlay and in-place preview` | `sortable` | `sortable-controller.test.ts` |
| Cancel restores the origin and announces it | `cancel restores the origin` | `sortable` | `sortable-controller.test.ts` |
| SSR-safe: no DOM at module load, no runtime dependencies | `SSR-safe entries` | all | `package.test.ts` |
| Testing helpers (fake frames, fake timer, measured lists, pointer events) | `testing helpers` | `testing` | every test file |

## Outside the engine (binding concerns)

These SortableJS options are rendering concerns, so they belong to the
binding (`@texuli/primitives/sortable`), not to this framework-free engine: ghost, chosen and drag CSS classes; FLIP and drop
animations (disabled under reduced motion); the drag overlay element;
`touch-action` on handles; debouncing pointer-drag announcements. The
engine supplies what they need: `state.delta`, `state.move.next`, lifecycle
events and message templates.
