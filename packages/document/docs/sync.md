# `@texuli/document/sync`

The owned CRDT behind an op-log transport (ADR-010). Replicas merge in any
delivery order with no server: every replica that integrated the same
operations holds the same state. Hosts own networking and storage behind a
`SyncAdapter`. The subpath is generic (it imports nothing else in
`@texuli/document`) and loads lazily: only a collaborative session pays for
it. Canvases, sheets and dashboards reuse it.

> **Status: in development.** Not on npm yet (first release planned for
> `0.7.0`). Documents bind to this core in
> [`@texuli/document/collab`](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/collab.md)
> (the tree diff, comments, suggestions, versions and presence); this
> subpath stays generic for canvases, sheets and dashboards.

```ts
import { connectReplica, createMemorySyncHub, createReplica, ROOT } from '@texuli/document/sync';

const hub = createMemorySyncHub();
const ada = createReplica({ replica: 'ada-1' });
const lin = createReplica({ replica: 'lin-7' });
connectReplica(ada, hub.adapter());
connectReplica(lin, hub.adapter());

const note = ada.insertNode('paragraph', ROOT, 0);
ada.insertText(note, 'text', 0, 'Hello');
ada.formatText(note, 'text', 0, 5, 'strong', true);
ada.undo(); // emits new operations; lin's edits are untouched
```

## The model

- **Ids and clocks.** Every operation has an id `(replica, counter)` and a
  Lamport time, and carries the `VersionVector` its author had integrated
  as `deps`. An insert of `k` code points uses `k` counters (one `ItemId`
  per code point); every other operation uses one. Replica ids are
  host-supplied (`REPLICA_PATTERN`, at most 40 characters; random per
  session). `MAX_CLOCK` bounds counters and Lamport times.
- **Sequences** (text and every ordered list): Fugue's non-interleaving
  tree, stored as run-length items, so concurrent typing at one place never
  interleaves. Positions are `SeqOrigin`s. Visibility is last-writer-wins
  per item, so a delete and a revive resolve by `Stamp` (`compareStamps`:
  Lamport time, then replica, then counter).
- **Marks** are anchored to item ids (`Anchor`) with an expand rule
  (`MarkExpand`): by default `link` never grows and every other key grows
  at its end. Text reads back as `SyncTextRun`s.
- **The tree** is Kleppmann's replicated move: moves are applied in stamp
  order with undo-do-redo; a move that would create a cycle (or nest past
  `SYNC_LIMITS.treeDepth`) is skipped on every replica alike. Sibling order
  is a sequence of slots. `ROOT` is the root; removed nodes move under
  `TRASH`.
- **Properties** are last-writer-wins registers (`null` clears one).

## Operations

`SyncOp` (`SyncOpKind`, each with the `SyncOpBase` fields): `CreateOp`
(register a node and its type), `MoveOp` (move under a parent at a new
slot, or into the trash), `SetOp`, `InsertOp`, `VisibilityOp` (`delete` or
`revive` id ranges) and `MarkOp`. Values are bounded `SyncJson`. Node ids
follow `NODE_PATTERN`, types `TYPE_PATTERN`, keys and fields
`KEY_PATTERN`. A `SyncBatch` carries `ops`, and optionally `have` (a
version vector) and `reply` for catch-up.

## Replicas

`createReplica(options)` returns a `Replica`. `ReplicaOptions`: `replica`,
`markExpand`, `markKeys` and `types` (closed sets; anything else is
dropped), and `undoLimit`.

- Local edits: `insertNode`, `moveNode`, `removeNode`, `setProp`,
  `insertText`, `deleteText`, `formatText` (indices in code points), and
  `transact(run)` to make several edits one undo step and one batch.
- Undo is local and selective: `undo()` and `redo()` emit new operations
  (hide what was inserted, revive what was deleted, move back while the old
  parent exists, rewrite the previous value). Shared history is never
  rewound.
- `ensureNode(id, type)` registers a node no parent holds (a container,
  once; concurrent calls merge), and `setNodeType(id, type)` changes a
  node's type (last writer wins; undoable). `editCount` counts the local
  transactions recorded as undo steps (monotonic), so a host can group
  them.
- Anchors: `itemAt(node, field, index)` is the item id at a visible
  index, `anchorIndex(node, field, anchor)` the visible index an `Anchor`
  stands for now (comments and cursors follow item ids through concurrent
  edits), `isVisible(node, field, id)` whether an item is visible, and
  `attached(id)` whether a node hangs under the root.
- Reading: `children`, `node`, `text`, `textRuns`, `toJSON()` (a
  `SyncNodeJson` tree, identical on converged replicas), `versionVector()`,
  `opsSince(have)`, `snapshot()` (a `SyncSnapshot`), `pending`, and
  `onOps(listener)` for local and remote batches.
- `receive(batch)` returns a `ReceiveResult`: integrated, duplicate,
  pending and dropped counts, or the reason a malformed batch was refused.

## Hostile input

`checkBatch(batch)` (a `BatchCheck`) validates every remote batch before
anything integrates, in time linear in the batch: at most 10,000
operations, bounded ids, clocks, version vectors, text, ranges, values and
total characters (`SYNC_LIMITS`). Malformed batches are refused whole.
Operations are deduplicated by id and buffered until causally ready (at
most 100,000 buffered). An operation that references an item its own
`deps` do not cover has no effect, the same way on every replica. Moves
arriving out of order are merged in one undo-do-redo pass per batch. Sync
is not authorization: the host decides who may write.

## Transports

- `SyncAdapter`: `send(batch)`, `subscribe(onBatch)`, optional
  `loadSnapshot`/`saveSnapshot`, and an optional `PresenceChannel`.
- `connectReplica(replica, adapter)` sends local batches, receives remote
  ones and exchanges version vectors on connect, so offline edits on
  either side catch up. It returns a `SyncConnection` (`close()`).
- `createMemorySyncHub({ manual })` returns a `MemorySyncHub` of in-memory
  adapters (tests, same-page panes); messages are copied through JSON and
  delivered on a microtask, or on `flush()` in manual mode.
- `createBroadcastChannelAdapter(key, { channel })` carries batches and
  presence between tabs of one origin on `syncChannelName(key)`. It reads
  the global `BroadcastChannel` only when called; pass a
  `BroadcastChannelLike` to supply your own. Messages from other apps are
  ignored.

WebSocket, IndexedDB and server transports are host adapters.

## Presence

Ephemeral and never in the log. A `PresenceState` holds the replica, a
host-provided display name, a token color index (0 to 11), an optional
`PresenceCursor` (the caret, `cursor`) anchored to an item id, and an
optional `anchor` cursor for the other end of a selection. `createPresenceStore({ ttl, now })`
returns a `PresenceStore` whose `list()` gives the live `PresenceEntry`s;
entries expire `PRESENCE_TTL` (30 seconds) after their last heartbeat.
`checkPresence` validates a remote state.
