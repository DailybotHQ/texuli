# @texuli/agent

The texuli.com agent service (agent-service design): a stateless worker that
turns a chat prompt into a **validated blueprint draft**, in the untrusted
tier, streamed as server-sent events with a validation receipt.

**Status: local service implementation in development. Nothing is deployed.**
There is no API key, and no real model provider has been called. Tests and
evals use a deterministic fake adapter that replays prompt-keyed text,
blueprint tool calls (whole, or streamed as `tool-delta` pieces) and usage
events, with configurable latency and injectable failures, timeouts and
mid-draft interruptions. Real adapters for the Anthropic Messages and
OpenAI-compatible Chat Completions streaming APIs exist as library code
(`fetch`, no SDK, key passed in at run time), tested only against fixture
byte streams, and nothing constructs one
([providers.md](docs/providers.md)). A real key would only ever live outside
the repository (`~/.config/texuli/` locally, or the hosting platform's secret
store), and choosing a provider, placing a key, wiring an adapter in and
deploying are developer decisions.
The worker requires `AGENT_SESSION_SECRET` with at least 32 UTF-8 bytes
before it issues or accepts session tokens; a future deployment must provide a
random secret through the platform secret store.

`tests/fixtures/golden-conversations.ts` holds fictional recordings replayed
through `createAgentService.draft`; `tests/golden-replay.test.ts` checks the
stream, validation receipt, repair loop, rate limit and kill switch offline.

Successful agent turns return a `validated` envelope and persist its
host-computed lifecycle receipt through `DraftStore`. The worker accepts an
optional `AGENT_DRAFTS` KV binding for durable records; without that binding,
it uses an isolate-local memory store. No activation is performed or inferred.

Every final draft response includes an action receipt with its artifact kind,
catalog hash, untrusted generation and validation tiers, completion time and
duration. It contains no prompt text or caller data. `GET /v1/receipts` returns
the receipts for the authenticated session (or the request IP in local mode).
With `AGENT_DRAFTS`, receipts are stored under a one-way hash of the session;
without it, they remain isolate-local and may disappear when the worker stops.

## Token ceilings

The service adds the provider's `inputTokens` and `outputTokens` from each
usage event. For budget accounting only, the documented illustrative cost is
one **fictional budget unit** per reported token; this is not currency, a
provider price, or a pricing API. Both ceilings reset at UTC midnight. The
defaults are 100,000 tokens per session per day and 1,000,000 tokens globally
per day. They are examples that can be replaced by the developer's budget.

Set both values with JSON text in `AGENT_TOKEN_BUDGETS`, for example
`{"perSessionDailyTokens":20000,"globalDailyTokens":200000}`, or put the same
fields under `tokenBudgets` in the local operator config at
`~/.config/texuli/agent.json`. The global counter is shared by all sessions
using one service instance. A worker isolate uses its own in-memory counter by
default; a host can inject a shared atomic `AGENT_TOKEN_USAGE` store when a
deployment-wide ceiling is required. Providers must emit usage events for
their tokens to be counted. If a call reports usage beyond a ceiling, its
reported usage is retained, the draft/repair result is withheld, and the
service returns a `rate-limited` refusal with a `token-budget` receipt and
`Retry-After`; breaker state records provider success, not failure.

The `POST /v1/draft` SSE response emits `accepted`, per-provider-step
`generating`, `validating`, optional `repairing`, and terminal `result` then
`done` events; failures emit `error` (with `retryable` for provider failures)
then `done`. The result contains the
validated envelope and receipt. The stream advances only when the consumer
requests data; canceling the response aborts the provider request. The complete
request/response shapes and operations guide are in the
[service contract and runbook](docs/service-runbook.md).

The service drafts; validation gates; the owner activates. It has no
activate, publish or send endpoint.

## Streaming generation

With `"stream": true` in the request (ADR-014), the SSE response also carries
the draft while the model writes it: `draft-chunk` texts that concatenate to
one untrusted draft envelope per attempt (ready for `<Player stream>`),
`node-ready` for each node shell that passed the catalog's node-level checks
(`validateStreamNode`, the gate's own options), `refused` for a node held with
its subtree (or `$` when the JSON itself stopped), and `final`, the full
`validateDraft` verdict, which is the only one that counts. See
[streaming.md](docs/streaming.md).

```bash
pnpm --filter @texuli/agent exec vitest run tests/streaming.test.ts
```

## Providers

`src/provider.ts` defines the provider interface: a request (closed system
prompt, the `emit_blueprint` tool, bounded turns, abort signal) becomes an
async stream of `text-delta`, `tool-delta` (`callId`, `name`, JSON text),
`usage`, `done`, or `error` with a `retryable` flag. `createFakeProvider`
replays recordings with deterministic chunking (`chunkSize`), latency
(`latencyMs`, injectable `sleep`) and injected stops (`outcome`, `cutAt`).
`createAnthropicProvider` and `createOpenAICompatibleProvider` speak the
documented streaming APIs with `fetch`, take every setting (key included)
from their options, and map HTTP and stream failures to typed errors.
Plugging one in with a key is a developer step: see
[providers.md](docs/providers.md).

```bash
pnpm --filter @texuli/agent exec vitest run tests/providers.test.ts
```

## Kill switch and circuit breaker

Both guards live in `src/guard.ts` and are checked **before every provider
call**, including each repair, so turning the agent off also ends a request
that is already running.

- **Kill switch.** The edge worker is on only when `AGENT_ENABLED` is `"1"`.
  The Node dev server is on unless `AGENT_ENABLED` is `"0"`, and it also reads
  an operator file, `~/.config/texuli/agent.json` by default (override with
  `AGENT_LOCAL_CONFIG`). `{ "enabled": false }` in that file hard-stops a
  running server within a second, whatever the environment says. The file
  holds no keys, other fields are ignored, and a missing or malformed file
  counts as no setting. Tests pass the file's text in and never read it.
- **Circuit breaker.** Three consecutive provider failures open the breaker
  (`DEFAULT_BREAKER`, configurable per service). While it is open, requests
  get `circuit-open` without reaching the provider. After the 30-second
  cooldown, one trial call goes through: success closes the breaker, failure
  reopens it. A caller hanging up does not count as a failure.
- **Receipts.** A refused request gets an `error` event, or a JSON error body,
  carrying a `GuardReceipt`: `guard` (`kill-switch`, `circuit-breaker`, or
  `token-budget`), the kill-switch `source` (`env`, `local-config` or
  `default`), breaker state and `retryAfterMs`, token budget scope/limit/usage,
  and how many provider calls ran before the stop. It holds no prompt text or
  caller data. Kill-switch and breaker refusals answer `503`; token-budget
  refusals answer `429`. A receipt with a retry delay adds a `Retry-After`
  header. Request-counter limits have no guard receipt. `GET /v1/health`
  reports kill switch and breaker state under `guards`.

Breaker state is per service instance, which means per worker isolate on an
edge platform. **Planned, not done:** sharing breaker state across isolates.

```bash
pnpm --filter @texuli/agent exec vitest run tests/guard.test.ts
```

## Hostile corpus

Prompt injection is expected, not prevented: the model's only power is to
emit closed data that the gate validates. `tests/fixtures/hostile-worker.ts`
holds the worker's own hostile corpus, and `tests/hostile-worker.test.ts`
replays it:

- **Prompt injection** (8 cases: instruction override, tier escalation, a
  forged tool call or assistant turn, exfiltration links, bidi and
  zero-width smuggling, a secret request, markup in copy), each answered by a
  hijacked fake model. The injection never reaches the system role or
  changes the instructions. Model text is plain: hidden and bidi characters
  are removed (`src/contain.ts`), and a reply that repeats at least 48
  characters of the system prompt or tool description is replaced with a
  "withheld" note, including when a matching excerpt crosses provider text
  events. The service retains a 47-character suffix while checking later
  events, then flushes it at completion so a streaming boundary cannot bypass
  the check. Worker-authored messages never echo the prompt.
- **JSON injection** (13 raw bodies: `__proto__` and `constructor`
  pollution, `tier` and `activate` fields, duplicate keys, `system` and
  `tool` history turns, a truncated body, hostile client drafts). Each is
  rejected with its status before any model call, through both the shared
  handler and the edge worker adapter, and `Object.prototype` stays clean.
- **Forged model output**: every `@texuli/catalog/render/hostile` sample as
  the root, inside a valid frame, or as markdown. Each result is `invalid`,
  or valid and inert when re-rendered in the untrusted tier, and it is never
  activated.
- A fictional session secret never reaches the model or a response.

Not covered: a real model provider (the adapters run against fixture streams
only). The hostile corpus includes a regression
where a guarded excerpt is split across streamed text deltas.

```bash
pnpm --filter @texuli/agent exec vitest run tests/hostile-worker.test.ts
```

## Provider keys

There is no key, and no real provider adapter is wired in (the adapters in
`src/providers/` take a key only from their caller). How a key would be held, where
it may live (`~/.config/texuli/agent.json` or the shell for local dev, the
platform's secret store for the edge worker), how it stays out of logs and
responses, and the xAI boundary are in [docs/key-store.md](docs/key-store.md).

## Offline evals

`pnpm exec tsx apps/agent/evals/run.ts` drives the service with the replay
provider across the golden audit fixtures and writes a deterministic summary
to `tmp/agent-evals/` (never committed).
`pnpm exec tsx apps/agent/evals/stream-run.ts` streams the golden audit
fixtures and the spec's golden blueprints through the SSE endpoint and
reports validity rate, refusal reasons, time to first node and total time to
`tmp/agent-evals/stream-report.json`, offline and deterministic on a virtual
clock. Real-provider evals are planned. See [docs/evals.md](docs/evals.md).

For every endpoint's request and response shape, guard order, local replay
runbook, receipt details, CSP deployment preconditions and incident steps, see
the [service contract and runbook](docs/service-runbook.md).

## CSP reports

`POST /v1/csp-reports` receives CSP violation reports from texuli.com pages
when a site build binds `PUBLIC_TEXULI_CSP_REPORT_URL`, and keeps only reduced,
counted fields. See [docs/csp-reports.md](docs/csp-reports.md).

---

Powered by [Dailybot](https://www.dailybot.com?utm_source=dailybotopensource&utm_medium=texuli-agent).
