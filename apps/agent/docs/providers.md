# Agent service: the provider interface and adapters

**Status: in the repository, not deployed.** The provider interface, the fake
replay provider and two real HTTP adapters (Anthropic Messages and
OpenAI-compatible Chat Completions) exist as library code. **No adapter has
been run against a real provider**: the tests drive them with fixture byte
streams through a fake `fetch`. The Node dev server and the edge worker still
answer with the replay provider and construct no real adapter. Choosing a
provider, placing a key, wiring an adapter in and deploying are developer
decisions ([ADR-014](../../../docs/DECISIONS.md#adr-014-streaming-generation-paint-only-validated-closed-node-shells)).

## The interface

`src/provider.ts`:

```ts
interface Provider {
  readonly label: string; // "<adapter>/<model>", shown in receipts
  generate(request: ProviderRequest): AsyncIterable<ProviderEvent>;
}
```

A `ProviderRequest` is the closed system prompt, the `emit_blueprint` tool as
plain JSON Schema, the bounded turns (`user`, `assistant`, and `tool` turns
that carry repair diagnostics) and the caller's abort signal. The service
builds the system prompt and the tool from the catalog only (`src/tools.ts`):
no request data reaches the system role. The prompt teaches the frame roots,
the heading rules, the nesting rule, the closed props, and the streaming
canonical order (`children` last in every node).

| `ProviderEvent` | Meaning |
| --- | --- |
| `text-delta` (`text`) | A piece of model text (`text`: a whole one, from older recordings) |
| `tool-delta` (`callId`, `name`, `text`) | A piece of a tool call's JSON input as the model writes it; the pieces of one `callId` concatenate to the input |
| `tool` (`name`, `input`) | A whole tool call, for providers or recordings that do not stream tool input |
| `usage` (`inputTokens`, `outputTokens`) | Incremental counts; the service adds them for the token ceilings |
| `error` (`code`, `message`, `retryable`) | The call stopped: `rate-limited`, `overloaded`, `auth`, `bad-request`, `network`, `timeout`, `protocol` or `interrupted` |
| `done` | The call completed |

The service reads the first `emit_blueprint` call (whole or streamed), parses
streamed input with `@texuli/spec/stream` (duplicate and prototype keys are
refused), and treats an `error` event like a thrown failure: the breaker
records it and the client gets `provider-error` with the `retryable` flag.

## The fake replay provider

`createFakeProvider(recordings, options)` replays recorded calls keyed by the
prompt. It is deterministic and offline:

| Option | Effect |
| --- | --- |
| `chunkSize` | Streams recorded `tool` calls as `tool-delta` pieces of this many UTF-16 code units (a list cycles, so tests split anywhere). The text is `canonicalJson(input)`: `children` last |
| `chunkText` | Splits text events into `text-delta` pieces too |
| `latencyMs`, `sleep` | Waits before every event; tests and the eval harness inject `sleep` to advance a virtual clock |

A recorded call can inject a stop: `{ events, outcome, cutAt, code, retryable }`.
`outcome: 'failure'` or `'timeout'` throws (a dropped connection);
`outcome: 'error'` yields a typed `error` event. `cutAt` stops the streamed
tool JSON after that many code units, which is how the tests interrupt a
draft at every offset.

## The real adapters

Both are written against the providers' documented HTTP streaming formats,
with `fetch` and no SDK, and share `src/providers/http.ts` and the SSE reader
`src/providers/sse.ts` (bounded lines and events, linear time).

| Adapter | Request | Stream it reads |
| --- | --- | --- |
| `createAnthropicProvider` | `POST <baseUrl>/v1/messages`, `"stream": true`, headers `x-api-key` and `anthropic-version` (default `2023-06-01`), `system`, `tools[].input_schema` | `message_start`, `content_block_start` (`text`, `tool_use`), `content_block_delta` (`text_delta`, `input_json_delta`), `message_delta` (usage), `message_stop`, `ping`, `error` |
| `createOpenAICompatibleProvider` | `POST <baseUrl>/chat/completions`, `"stream": true`, `stream_options.include_usage`, `authorization: Bearer`, the system prompt as the first message, `tools[].function.parameters` | `data:` chunks with `choices[0].delta.content` and `delta.tool_calls[]` fragments, the final `usage` chunk, `data: [DONE]` |

Options (`HttpProviderOptions`), all explicit:

| Option | Meaning |
| --- | --- |
| `apiKey` | The key, as a string or a `Secret` (`src/keys.ts`). Wrapped at once; only the request headers reveal it |
| `model` | The model name the developer chose |
| `baseUrl` | Default `https://api.anthropic.com` or `https://api.openai.com/v1`; must be `https` (plain `http` only on loopback) |
| `maxTokens` | Output ceiling per call (default 4,096) |
| `timeoutMs` | Deadline per call (default 120,000) |
| `fetch` | The fetch to use (tests pass a fake one) |
| `label` | Receipt label (default `anthropic/<model>` or `openai-compatible/<model>`) |

Behavior both share:

- **Nothing read from the environment or files.** The adapters take every
  setting from their options; a test checks the sources for `process.env`,
  file access and package imports.
- **Typed, retryable errors.** HTTP 429 is `rate-limited`, 408 `timeout`, 409
  and 5xx `overloaded` (all retryable); 401 and 403 are `auth`, other 4xx
  `bad-request` (not retryable). A failed `fetch` is `network`, the adapter's
  deadline `timeout`, a stream that ends before `message_stop` or `[DONE]` is
  `interrupted` (retryable). A non-SSE response or non-JSON data is
  `protocol`. Messages name the status or the provider's error type token
  only: response bodies and the key never reach a message.
- **Usage** is reported incrementally from the providers' running totals.
- **Turns.** Our `tool` turns (repair diagnostics) are sent as user text,
  because the service keeps no provider tool ids. The Anthropic adapter also
  merges consecutive same-role turns and starts with a user turn.
- **Abort.** The caller's signal cancels the request; an aborted call ends
  without an error event.

## Plugging in a real provider (a developer step)

This is not done anywhere in the repository. A host that decides to use a
provider constructs the adapter with a key it reads **at run time, from
outside the repository** (the platform's secret store, or the operator file
`~/.config/texuli/agent.json`, see [key-store.md](key-store.md)), and passes it
to the service:

```ts
import { createAgentService, createAnthropicProvider, loadCatalog } from '@texuli/agent';

const build = await loadCatalog();
const service = createAgentService({
  catalog: build.catalog,
  catalogHash: build.hash,
  provider: createAnthropicProvider({
    apiKey: keyFromTheHostSecretStore, // a Secret from resolveProviderKey, never a literal
    model: '<the model the developer chose>',
  }),
});
```

`createOpenAICompatibleProvider({ apiKey, model, baseUrl })` is used the same
way for any server with the Chat Completions streaming shape. Before doing it:

1. The developer chooses the provider and the model, and creates the account.
2. The key goes to the platform secret store (or the operator file for local
   dev), never into the repository, a test, a log or an `.env` file.
3. The token ceilings ([README](../README.md#token-ceilings)) and the kill
   switch stay on; the receipts carry the adapter label.
4. Deploying the worker stays a separate developer step
   ([service-runbook.md](service-runbook.md)).

## Tests

```bash
pnpm --filter @texuli/agent exec vitest run tests/providers.test.ts
pnpm --filter @texuli/agent exec vitest run tests/streaming.test.ts
```

`tests/fixtures/provider-streams.ts` holds hand-written fixture streams in
each documented shape (fictional ids and counts; no provider was called to
make them). The adapter tests split the response bytes anywhere, check the
request bodies and headers, map every error class, and stream a golden tree
through each adapter into the service to a validated `final` draft.

## Planned, not done

- Running either adapter against a real provider, and real-provider evals
  (`runStreamEval({ provider })` takes any provider; no script builds one).
- Provider-side retries with backoff: today a retryable error reaches the
  client, which may send the request again.
- Native tool-result turns (provider tool ids) for repairs.
