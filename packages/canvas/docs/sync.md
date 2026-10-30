# `@texuli/canvas/sync`

Collaborative canvases on the CRDT core of `@texuli/document/sync`
(ADR-010). Replicas merge in any delivery order with no server; hosts own
transports and storage behind a `SyncAdapter`. Framework-free; load it only
for collaborative sessions.

> **Status: in development.** On npm from `0.8.0`, the package's first
> release (pre-1.0).

```ts
import { createMemorySyncHub } from '@texuli/document/sync';
import { moveOps } from '@texuli/canvas/model';
import { createCanvasSync } from '@texuli/canvas/sync';

const hub = createMemorySyncHub();
const ada = createCanvasSync({ replica: 'ada-1', canvas });
const lin = createCanvasSync({ replica: 'lin-7', canvas });
ada.connect(hub.adapter(), { name: 'Ada', color: 1 });
lin.connect(hub.adapter(), { name: 'Lin', color: 4 });
ada.apply(moveOps(ada.canvas, ['note'], { x: 8, y: 0 }));
ada.undo(); // selective: Lin's edits stay
```

## The binding

- **Tree.** Every shape is a node (id = shape id, type = shape type) under
  the root or its frame or group, so moving into a frame, grouping and
  z-order (sibling order is a sequence) merge through the move-safe tree.
- **Registers.** Geometry, style and every other field are last-writer-wins
  properties. A line's or path's `points` are one bounded register (at most
  1,000 points), so concurrent redraws keep one writer's whole stroke.
- **Sequences.** Shape text, frame titles and connector labels are text
  fields, so concurrent typing merges.
- Connectors are nodes under the `CONNECTORS_NODE` container
  (`tx:connectors`); metadata and the grid are root properties. A replica
  accepts only `CANVAS_NODE_TYPES`.

`commitCanvas(replica, next)` writes a valid canvas as the id-keyed edits
that produce it (one transaction: one undo step, one batch).
`projectCanvas(replica, { trust })` reads it back as a canvas that always
passes `validateCanvas`: remote values that fail the schema drop the shape
or connector they sit on (and empty groups go), deterministically, so every
converged replica projects the same canvas.

## Sessions

`createCanvasSync(options)` returns a `CanvasSync`. `CanvasSyncOptions`:
`replica` (1 to 40 of `A–Z a–z 0–9 _ -`, random per session), `canvas`
(every replica starts from the same canvas; `canvasSeedOperations` derives
its operations from the content under a `seed-<hash>` replica, so identical
starts merge as one and are no one's undo step), `trust` and `undoLimit`.
`EMPTY_CANVAS` is a blank start for sessions that load a snapshot.

- `canvas` is the projection; `apply(ops)` applies canvas operations to it
  and commits the result as one undo step; `commit(next)` commits a whole
  canvas.
- `undo()` and `redo()` are the CRDT's selective undo: they emit new
  operations and never rewind other replicas' edits. `canUndo`, `canRedo`.
- `receive(batch)` integrates a remote batch (validated by the sync core);
  `subscribe(listener)` (`CanvasSyncListener`) hears every local and remote
  change.
- `connect(adapter, { name, color })` returns a `CanvasConnection`: batches
  flow both ways (split to the 10,000-operation batch limit), version vectors
  catch up offline edits, and presence travels on the adapter's channel.
  `updatePresence({ point, selection })`, `close()`.
- `peers()` lists live presence; `destroy()` stops listening.

## Presence

Ephemeral, never in the log. A `CanvasPresenceState` holds the replica, a
host-provided name, a token color index (0 to 11), an optional world
`point` and an optional `selection` (at most `PRESENCE_SELECTION_LIMIT` ids).
`checkCanvasPresence` validates a remote state; `createCanvasPresenceStore`
returns a `CanvasPresenceStore` whose `list()` gives live
`CanvasPresenceEntry`s (expired 30 seconds after the last heartbeat) and
whose `has(replica)` tells whether a peer is live. The store keeps at most
`SYNC_LIMITS.replicas` (1,024) entries: `update` returns `false` for a new
replica past the cap until entries expire or leave, and expiry work is
constant amortized per update. A session answers a burst of newcomers with
one presence broadcast, not one per new replica.
Hosts read `peers()` to show who is here; painting remote pointers and
selections inside `CanvasEditor` is planned.

## Tests

Seeded convergence: 1,000 cases of three replicas making random canvas
edits (adds, moves, resizes, rotations, text, deletes, groups, ungroups,
reorders, reparenting, connectors, undo and redo), with batches delivered
partially, reordered and duplicated, reach identical CRDT states and
identical, valid projections. Hostile batches (invalid values, unknown
types) are neutralized the same way on every replica.
