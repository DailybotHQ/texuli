# Streamed blueprints

**Package:** `@texuli/spec`  
**Import:** `@texuli/spec/stream`  
**Design:** [ADR-014](../../../docs/DECISIONS.md#adr-014-streaming-generation-paint-only-validated-closed-node-shells)  
**Tests:** `packages/spec/tests/stream.test.ts`  
**Status:** new in `0.6.0` (in development, pre-1.0); `@texuli/spec@0.5.0`
and earlier don't have this subpath. Spec `0.7.0` plans the optional node
`key` (ADR-012).

## Goal

Agents write blueprints token by token. `@texuli/spec/stream` reads that
text as it arrives, so a host can paint each node as soon as it is
complete, without guessing at half-written values. It parses only; it
judges no rule. A host checks each node with `validateStreamNode` from
`@texuli/catalog/validate`, and the complete draft with `validateDraft`,
which stays the only path to a valid draft. `<Player stream>` from
`@texuli/player` does both.

The wire format does not change: a streamed blueprint is the same JSON as a
whole one (one format for the Kotlin twin, the tools and the golden set).

## The tokenizer

`createJsonTokenizer(options)` (`JsonTokenizerOptions`: `maxBytes`,
`maxDepth`) returns a `JsonTokenizer`. `write(chunk)`
returns the `JsonStreamEvent`s (tokens) that closed in that chunk: `open`
and `close` for objects and arrays, `key` for a member name and `value` for
a `JsonScalar` (string, number, boolean or `null`). `end()` closes a
trailing top-level number or reports `truncated`. `bytes`, `depth`,
`error` and `done` describe where it stands.

- **Chunks split anywhere.** Inside a string, an escape, a `\u` sequence,
  a number, a literal or a UTF-16 surrogate pair: the result is the same as
  one chunk. It accepts exactly what `JSON.parse` accepts, with two
  refusals more (below), and produces the same values.
- **Linear time, bounded memory.** One pass over every code unit, no
  backtracking and no recursion. Memory is bounded by the byte budget
  (`maxBytes`, default `DEFAULT_STREAM_MAX_BYTES`: the catalog's 256 KiB
  tree cap plus 8 KiB) and the depth cap (`maxDepth`, default
  `DEFAULT_STREAM_MAX_DEPTH`, 128 nested containers).
- **Refusals at a UTF-8 byte offset.** A `StreamError` has a
  `StreamErrorCode` and the `offset` of the refused byte: `bad-json`,
  `too-large`, `too-deep`, `duplicate-key` (`JSON.parse` keeps the last; a
  stream refuses it), `prototype-key` (`STREAM_PROTOTYPE_KEYS`:
  `__proto__`, `constructor`, `prototype`, anywhere) and `truncated`.
  Readers add `aborted` and `connection`. After an error the tokenizer
  reports nothing more.

## The assembler

`createBlueprintAssembler(options)` returns a `BlueprintAssembler`: it runs
the tokenizer, builds the value, and reports `BlueprintStreamEvent`s for
the blueprint's structure. `BlueprintAssemblerOptions` adds `treeMembers`
(default `['tree']`; the player also passes `blueprint`, the member of its
local-state wrapper) to the tokenizer options.

**The canonical order** (`STREAM_NODE_ORDER`): streamed nodes put
`children` last (`key`, `id`, `slot`, `props`, `when`, `bind`, `on`,
`children`), and envelopes put `state` and `flow` before the tree. So a
node's shell (a `StreamNodeShell`: every member but `children`) is final
once `children` starts, or once the node closes without it, and the
envelope header is final once `tree` starts.

| Event | When |
| --- | --- |
| `header` | The envelope members before the tree, once the tree starts; again when a late member's value closes |
| `node-start` | A node object opened (`path`, `parent`, `index`, `inArray`) |
| `node-id` | A node's `id` closed (a host shows the skeleton of its family) |
| `node` | A node's shell is final: `shell`, `hasChildren`, and `streamId` (its `key` when it has a string one, else its path) |
| `node-end` | A node object closed |
| `stream-order` | A member after `children` (path of the node) or after the tree (path `$`): hosts hold that node, or every node for `$`, until the final verdict |
| `complete` | The whole value arrived and `end()` found nothing after it |
| `error` | The stream stopped (`StreamError`) |

Node paths are the ones `validateDraft` and the player use (`0`,
`0.children.1`, or the index of each root of an array of roots). They stay
stable while streaming, because streamed children only append. Spec 0.7.0
plans an optional node `key` (ADR-012); until a spec version admits it, a
node with `key` is refused by the catalog's node checks, so stream ids are
paths in practice.

`abort(code, message)` stops the assembler with an `aborted` or
`connection` error (a host whose source dropped).

```ts
import { createBlueprintAssembler } from '@texuli/spec/stream';

const assembler = createBlueprintAssembler();
for await (const chunk of agentChunks) {
  for (const event of assembler.write(chunk)) {
    if (event.type === 'node') checkAndPaint(event.path, event.shell);
    if (event.type === 'error') showError(event.error);
  }
}
for (const event of assembler.end()) {
  if (event.type === 'complete') judgeWithValidateDraft(event.value);
}
```

## The push handle

`createBlueprintStream()` returns a `BlueprintStreamHandle`, an
`AsyncIterable<string>` a host writes into: `write(text)` queues a chunk,
`end()` completes the stream, `abort(reason)` stops it, and `closed` says
whether either happened. A reader gets the queued chunks first; after
`abort()` its iteration throws a `BlueprintStreamAbortError` (named
`AbortError`). One reader per handle; a reader that stops listening
(`return()`) closes the handle.

```ts
import { createBlueprintStream } from '@texuli/spec/stream';

const stream = createBlueprintStream();
// <Player stream={stream} /> reads it
agent.on('delta', (text) => stream.write(text));
agent.on('done', () => stream.end());
agent.on('error', () => stream.abort('The agent stopped.'));
```

## What it does not do

- It validates no node and no draft: the catalog does
  (`validateStreamNode`, then `validateDraft`).
- It does not repair JSON or close open brackets: a value is reported only
  once it closed, so nothing is painted that the agent did not finish
  writing.
- Native streaming in the Kotlin twin is planned.
