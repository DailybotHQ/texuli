# Agent service: streaming generation

**Status: in the repository, not deployed.** `POST /v1/draft` with
`"stream": true` streams the draft while the model writes it
([ADR-014](../../../docs/DECISIONS.md#adr-014-streaming-generation-paint-only-validated-closed-node-shells)).
Tests run it with the fake replay provider only.

## What the service does

1. The provider streams the `emit_blueprint` input (`{"tree": …}`) as
   `tool-delta` pieces ([providers.md](providers.md)). A whole `tool` call is
   streamed as one piece, so clients see one shape either way.
2. `src/draft-stream.ts` reads the pieces with `@texuli/spec/stream` and
   **re-frames** them: the first `draft-chunk` of an attempt starts with the
   service's own draft envelope header (`format`, `id`, `catalog`, `status:
   "draft"`, times, `generator`), then the model's tree text exactly as
   written, then `}`. Text the model writes around the tree is never
   forwarded, and a chunk the tokenizer refuses is never forwarded.
3. Each node whose shell is final (every member but `children`) is checked
   with the catalog's `validateStreamNode`, under that header, with exactly
   the options of the service's gate (untrusted tier, the URL policy, the
   sink scan, block schemas, the host validators for `document`,
   `schema-form` and `canvas` nodes, the limits measured so far). The gate
   holds no data-source registry, so a `{"$source": …}` binding (spec
   0.8.0) is refused here and in the final verdict alike. It is reported
   `node-ready`, or `refused` with its codes; a refused node holds its whole
   subtree (`held`). A member after `children` is `stream-order`. A
   tokenizer refusal (bad JSON, too large, too deep, a duplicate or
   prototype key) is `refused` at `$` with `stream-<code>`.
4. When the call ends, the complete input goes through the full
   `validateDraft` and the inertness check, as without streaming. That
   verdict is `final`, and it is the only one that counts: a draft is valid
   only if `final` says so. In stream mode the validated envelope is the
   streamed one (same id, times and tree; validation sets `status:
   "validated"` and stamps `spec`).
5. If it is refused, the repair loop starts a new attempt, and its chunks
   carry the next `attempt` number: a new envelope.

The event shapes are in the
[service runbook](service-runbook.md#streaming-generation-stream-true).

## A client

A browser client reads the SSE response and writes each attempt's chunks
into a `createBlueprintStream()` handle (`@texuli/spec/stream`) that a
`<Player stream>` (`@texuli/player`, see its `docs/streaming.md`) reads. The
player runs its own node checks and its own final `validateDraft`; the
service's `node-ready` and `refused` events are for progress and logs, not
a reason to trust anything.

```ts
import { createBlueprintStream } from '@texuli/spec/stream';

let attempt = 0;
let stream = createBlueprintStream();

function onAgentEvent(event) {
  if (event.type === 'draft-chunk') {
    if (event.attempt !== attempt) {
      attempt = event.attempt;
      stream = createBlueprintStream(); // a repair: a new stream, applied as a live update
      showPlayer(stream);
    }
    stream.write(event.text);
  } else if (event.type === 'refused' && event.path === '$') {
    stream.abort('The draft stream stopped.');
  } else if (event.type === 'final') {
    stream.end();
    keepDraft(event.result); // the validated envelope, or the refusal
  } else if (event.type === 'error') {
    stream.abort(event.retryable ? 'Try again.' : 'The agent could not answer.');
  }
}
```

This client is a sketch: the website's chat island does not use streaming
mode yet (planned).

## Interruption

A provider that drops mid-draft (a throw, an `error` event, a stream that
ends early) ends the response with `error` (`provider-error`, with
`retryable`) and `done`, and no `final`. Everything forwarded before it is a
clean prefix of an envelope, so a player marks the painted nodes incomplete
and never activates anything. `tests/streaming.test.ts` interrupts the
dashboard fixture at about a hundred offsets and checks exactly that.

## Tests

```bash
pnpm --filter @texuli/agent exec vitest run tests/streaming.test.ts
```

They cover the fake provider's chunking, latency and injected stops; one
envelope per attempt that equals the validated one; identical results for
every chunking; the v1 stream unchanged without `stream`; refused, held and
`stream-order` nodes; every tokenizer refusal; interruption at every offset;
typed provider errors; and the SSE frames end to end.
