# `@texuli/document/collab`

Collaborative documents: the ADR-010 CRDT of
[`@texuli/document/sync`](https://github.com/DailybotHQ/texuli/blob/main/packages/document/docs/sync.md)
bound to the ADR-011 document format. A `DocumentSync` session keeps one
replica of a document and bridges it to an editor's op log, which stays
the single edit path: the editor applies its own operations, hands each
accepted result to the session, and applies the operations the session
hands back for merged states. Comments anchor to item ids, suggestions
are attributed marks, named versions restore with new operations, and
presence carries carets between peers. Framework-free and DOM-free; it
loads lazily (only a collaborative session imports it).

> **Status: in development.** On npm from `0.7.0`, the package's first
> release (pre-1.0). The editor UI is `@texuli/pages/collab`.

```ts
import { createDocumentSync } from '@texuli/document/collab';
import { applyOperations } from '@texuli/document/ops';
import { createMemorySyncHub } from '@texuli/document/sync';

const hub = createMemorySyncHub();
const session = createDocumentSync({ replica: 'ada-4f2', document, author: { name: 'Ada', color: 3 } });
session.connect(hub.adapter()); // or createBroadcastChannelAdapter(key), or your own SyncAdapter

let editorDoc = session.document;
session.subscribe(({ operations }) => {
  if (operations.length > 0) editorDoc = applyOperations(editorDoc, operations).document;
});

// A local edit: apply it to the editor's document, then commit the result.
const result = applyOperations(editorDoc, [{ op: 'insert-text', id: 'p1', offset: 0, text: 'Hi ' }]);
if (result.ok) {
  editorDoc = result.document;
  session.commit(editorDoc, { group: 'typing:p1' });
}

session.addComment({ block: 'p1', from: 0, to: 2 }, 'Friendlier? @{u-7|Lin}');
const version = session.saveVersion('Before review');
session.restoreVersion(version); // new operations; undo brings the edits back
```

## How a document maps onto the CRDT

Every block, column and list item is a tree node whose id is its persisted
id and whose type is its kind (`item` for a list item). Attributes
(`NODE_ATTRS` of `@texuli/document/ops`) are last-writer-wins registers;
values beyond the register bounds (a large inline embed payload) travel as
one chunked register, so concurrent replacements never mix. The text of
paragraphs and headings (`content`), toggles (`summary`) and code blocks
(`text`) is a sequence: a break is a `\n` unit, and the `strong`, `em`,
`strike`, `code` and `link` marks are CRDT marks (links never grow at their
end, emphasis does: `collabMarkExpand`). Metadata and page settings are
registers on the root. Comment threads, suggestion records and versions
live in detached containers (`COMMENTS_NODE`, `SUGGESTIONS_NODE`,
`VERSIONS_NODE`) that no block can name. A replica accepts only
`COLLAB_NODE_TYPES` and `COLLAB_MARK_KEYS`; anything else a peer sends is
dropped, the same way everywhere.

Offsets in this API are UTF-16 code units of a block's text (a break
counts 1), as in `@texuli/document/ops`.

## Sessions

`createDocumentSync(options)` returns a `DocumentSync`.
`DocumentSyncOptions`: `replica` (host-supplied, random per session),
`document` (the starting document), `author` (`name`, token `color` 0 to
11), `tier` (the URL tier the projection validates at, `untrusted` by
default; every replica of a document must use the same), `now`, `groupMs`,
`undoLimit` and `heartbeat`.

- **Seeding.** `seedOperations(doc)` derives the starting operations from
  the content (a replica named `seed-<hash>`), so every replica that starts
  from the same document holds the same seed and independent starts merge
  as one. Comment threads in `doc.annotations` are seeded too, anchored to
  the seeded text. Replicas that start from different documents duplicate
  content: start from the same document, or `load(snapshot)`.
- **Reading.** `document` is the projection (below); `projection` adds the
  text views; `subscribe(listener)` is called with a `DocumentSyncChange`
  (`origin` as a `DocumentSyncOrigin`, `document`, `operations`) after
  every change. `operations` are the document operations that bring the
  editor's document to the projection; they are empty when only
  annotations or presence changed.
- **Local edits.** `commit(next, { group })` emits the replica operations
  that make the projection equal `next` (the id-keyed tree diff:
  `commitDocument` with a `CommitContext`, whose optional `SuggestContext`
  turns text edits into suggestions) and returns the corrections
  (also sent to listeners): none for an ordinary edit; in suggestion mode
  the struck text the editor deleted comes back.
- **Undo** is the replica's: `undo()` and `redo()` emit new operations that
  revert this author's step and keep everyone else's; commits of one
  `group` within `groupMs` are one step; `canUndo` and `canRedo`.
- **Transport.** `connect(adapter)` syncs both ways through a `SyncAdapter`
  (offline edits catch up on connect) and returns a connection;
  `disconnect()`, `receive(batch)` for hosts that move batches themselves,
  `snapshot()` and `load(snapshot)` for persistence, `close()` to stop
  every timer.

## The projection

A merge of valid edits can still form what no single editor makes: a list
item whose first block a concurrent move made a heading, a columns block
left with one column after two peers removed different columns, more
blocks than the cap. `Projector` (with `ProjectorOptions`) turns a replica
into a `Projection` whose `document` always validates at its tier: nodes a
parent cannot hold, characters a text field refuses, links the URL policy
refuses and nodes past the caps are left out, then every node the
validator still points at is left out until the document validates. It is
a pure function of the replica state, so every replica projects the same
document; nothing is deleted from the replica (an undo brings it back), and
`repaired` counts what was left out. Each projected text node has a
`FieldView`: its units, their item ids, marks and suggestion ids, and their
UTF-16 offsets.

## Comments

- `addComment(target, body)` opens a thread on a `CommentTarget`: a block,
  or a UTF-16 range of a text block. The range anchors to the item ids of
  its first and last character, so it follows the text through concurrent
  edits.
- `threads()` lists `CollabThread`s (anchored ones in document order, then
  orphaned ones): `status`, `author`, `block`, the current `range` (or
  `null`), the `quote` taken when it was opened, `orphaned` (the block left
  the document or every character of the range was deleted) and its
  `CollabMessage`s.
- `reply(thread, body)`, `resolve(thread)`, `reopen(thread)` and
  `deleteComment(id)` (a thread or one message). Every change syncs and
  undoes like an edit.
- Mentions use the G48 inline extension grammar `@{id|label}`:
  `parseMentions(body)` returns `CommentSegment`s (text and
  `CommentMention`s) in linear time, and every message carries its
  `segments` and `mentions` for the host to notify people.
- `exportAnnotations()` returns the threads as document annotations (UTF-16
  anchors) to store with the document.
- `ANNOTATION_LIMITS` caps bodies (4,000 code points), names, quotes,
  version names and how many threads, messages and versions are read back.
  Everything read back from peers is validated; malformed records are
  skipped.

## Suggestions

Set `suggesting = true` and local text edits become suggestions: inserted
text gets the `SUGGEST_INSERT` mark and deleted text the `SUGGEST_DELETE`
mark (it stays visible, struck), both valued with one suggestion id per
transaction; typing next to your own suggestion extends it, and deleting
your own suggested text really deletes it. Structural edits (inserting,
moving and removing blocks) and formatting apply directly in this release.

`suggestions()` lists the pending `CollabSuggestion`s (author, `mine`, and
their `SuggestionChange`s: block, insert or delete, UTF-16 range and text).
`accept(id)`, `reject(id)`, `acceptAll()` and `rejectAll()` emit ordinary
operations (keep or delete the text, drop the marks), so they sync and undo
as one step.

## Versions

`saveVersion(name)` names the current state (its version vector);
`versions()` lists `CollabVersion`s, oldest first. `versionDocument(id)`
rebuilds the document at a version by replaying the operations it covers.
`compare(from, to?)` and `describeChanges(before, after)` list
`DocumentChange`s for people: metadata and page changes, added, removed and
moved blocks, text edits (before and after), formatting-only edits and
attribute changes. `restoreVersion(id)` emits the operations that turn the
current state into the version's: history is never rewritten, the restore
reaches every peer, and one undo reverts it. `diffDocuments(from, to)` is
the document-level diff behind the editor bridge: operations of
`@texuli/document/ops` that turn any document into any other by id.

## Presence

`setSelection({ focus, anchor })` announces this author's caret or
selection as `DocumentPoint`s (a block and a UTF-16 offset), anchored to
item ids; `collaborators()` lists the live `Collaborator`s with their
`focus` and `anchor` mapped through every edit made since. Presence is
never in the log; it is sent on every change and a heartbeat (10 seconds)
and expires 30 seconds after the last one. Remote states are validated
(names without control or bidi characters, colors 0 to 11).

## Security and limits

- Every remote batch is validated by `@texuli/document/sync` before it
  integrates; the projection validates the result at the session's tier,
  so a hostile peer can hide content (as it could delete it) but cannot
  make a document that fails the schema, an unsafe link or a control
  character.
- Sync is not authorization: the host decides who may write.
- Known gaps: the op log is never compacted yet (tombstones and the full
  log are kept within the document caps); suggestions track text
  insertions and deletions only; a node a merge leaves invalid stays
  hidden until an undo or an edit by its author repairs it.
