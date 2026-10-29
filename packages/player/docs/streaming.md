# Streaming mode

**Package:** `@texuli/player`  
**Prop:** `<Player stream={source}>`  
**Design:** [ADR-014](../../../docs/DECISIONS.md#adr-014-streaming-generation-paint-only-validated-closed-node-shells)  
**Tests:** `packages/player/tests/streaming.test.ts` (the component),
`packages/player/tests/stream-session.test.ts` (the session),
`tests/e2e/player-streaming.spec.ts` (the browser)  
**Status:** in the repository, unreleased. It is planned to ship with the
`0.7.0` release; no published `@texuli/player` has it yet.

## Goal

An agent writes a blueprint token by token. In streaming mode the player
paints each node as soon as it is complete and checked, instead of
waiting for the whole draft, and adds speed without adding trust: the
complete draft still goes through the full `validateDraft`, which stays
the only path to a valid draft and to armed actions.

## Usage

```svelte
<script lang="ts">
  import { Player } from '@texuli/player';
  import { createBlueprintStream } from '@texuli/spec/stream';

  let stream = $state(createBlueprintStream());
  // The host feeds it: an agent's deltas, server-sent events, a fetch body.
  agent.onDelta((text) => stream.write(text));
  agent.onDone(() => stream.end());
  agent.onError(() => stream.abort('The agent stopped.'));

  function retry() {
    stream = createBlueprintStream(); // a new stream: the player restarts its paint
    agent.regenerate();
  }
</script>

<Player {stream} onStreamRetry={retry} onStreamProgress={(p) => console.info(p.phase, p.painted)} />
```

`stream` is a `BlueprintStreamSource`: any `AsyncIterable<string | Uint8Array>`
(bytes are decoded as UTF-8 across chunk boundaries), such as the
`BlueprintStreamHandle` that `createBlueprintStream()` returns
(`@texuli/spec/stream`; add `@texuli/spec` to your dependencies to import
it). The player's root exports only the types and constants, so the
handle costs nothing to hosts that stream another way.
While `stream` is set, `blueprint` is ignored. `mountPlayer` passes it like
any other prop.

| Prop | Meaning |
| --- | --- |
| `stream` | The source. A new source restarts the paint (a retry) |
| `onStreamProgress` | Called with a `PlayerStreamProgress` (`phase`, `painted`, `held`, `bytes`, `error`) as the paint moves, stops or completes |
| `onStreamRetry` | When set, an interrupted stream shows a "Try again" button that calls it; the host passes a new `stream` |

## How a node paints

1. The session (loaded only when `stream` is used) reads the text with
   `@texuli/spec/stream`. Chunks may split anywhere.
2. A node's **shell** (every member but `children`) is final once
   `children` starts, or once the node closes. Streamed nodes put `children`
   last; envelopes put `state` and `flow` before the tree.
3. The shell must pass every node-level rule before it paints: the
   player's own state pipeline (bindings, state-only controls, flows,
   action forms, host-bound writers) on the node's chain, then the
   catalog's `validateStreamChain` with exactly the options the player
   validates with (closed id and props, prop schemas, the URL policy at
   the host's tier, the sink scan, block schemas, the totals measured so
   far), then the player's state rules on the partial tree, so rules
   between siblings (one field name per form) hold too.
4. Until then the node shows a skeleton of its catalog family
   (`STREAM_PENDING_ID` marks its place; `StreamNodeState` `pending`). A
   node a check refuses, or whose member arrived after `children` (a
   `stream-order` issue), is **held** with its whole subtree: a static
   "Waiting for the complete draft." note in place, never its content.
5. Snapshots are applied at most every `STREAM_PAINT_INTERVAL_MS` (50 ms),
   on the same player handle, so painters load once and stay loaded.
6. When the stream completes, the whole value is validated with
   `validateDraft` and the host's `invalidPolicy`. If it is refused, the
   painted prefix is replaced by the refusal notice. If it is valid, the
   paint is the paint of the same blueprint passed whole (the browser spec
   compares the markup).

Rules that need the whole tree (composition grammar, the root rule) run
only in that final verdict.

## While streaming

- **Status.** `data-status` and the badge read `streaming` ("Generating"),
  then the host status or `invalid`, or `interrupted`
  (`PlayerShownStatus`). Partial drafts report no `onDiagnostics`; the
  final verdict does.
- **Busy and inert.** The surface is `aria-busy="true"` and `inert`: no
  focus, no pointer input, nothing to activate.
- **Announcements.** The polite region says "Generating content." once,
  then at most every `STREAM_ANNOUNCE_INTERVAL_MS` (4 s) how many parts are
  shown, never once per node. The paint announcement follows the final
  verdict as usual.
- **Disarmed.** Until the complete draft passes validation, no action
  runs: state writes, `on` actions (`emit`, `submit`, `flowGo`), flow
  events and list moves are refused, and an action form's receipt is
  "unavailable". The envelope stays `draft`.

## Interruption and retry

A source that throws, an `abort()`, a refused byte (bad JSON, over the
byte budget, too deep, a duplicate or prototype key) or a stream that ends
early (`truncated`) stops intake:

- the painted, validated nodes stay, and nodes that never finished show a
  static "Not received." note (`incomplete`);
- the status is `interrupted`, and a `role="alert"` message says the
  content is incomplete (with "Try again" when `onStreamRetry` is set);
- the surface is readable again (not inert), but nothing is ever armed:
  activation never runs on an interrupted draft.

A retry is a new `stream`. The previous paint stays (marked as streaming
again) until the new stream paints its first node; then the new partial
draft replaces it as a live update, so nodes at the same path keep their
painter and state. Resuming from a byte offset is not supported: a retry
streams the blueprint again from the start.

## Labels

Hosts localize the streaming copy through `labels`: `status.streaming`,
`status.interrupted`, `streamStarted`, `streamProgress` (`{count}`),
`streamInterrupted`, `streamRetry`, `streamPending`, `streamHeld` and
`streamIncomplete`.

## Not covered

- Stable node keys: spec 0.7.0 plans an optional node `key`; until a spec
  version admits it, streamed nodes are matched by path (stable, because
  streamed children only append).
- Native streaming in the Kotlin twin is planned.
