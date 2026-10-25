# Agent service contract and runbook

**Status: local implementation only.** `apps/agent` exposes a shared fetch
handler and Node/worker adapters. They currently use the deterministic replay
provider; there is no real provider adapter, no deployed worker, and no deployed
website. A provider, key, hosting project, quota backend, and every deployment
require developer decisions and GO. Local development and the offline evals
need no key and make no provider or network call.

## HTTP API

When an `Origin` header is present, it must exactly match the configured
`allowedOrigin` or the handler rejects it with `403`. Configure this explicitly
for a hosted browser client. Responses are JSON unless the draft request asks
for SSE. There are no activation, publish, send, or deploy routes.

| Route | Request | Success response | Notes |
| --- | --- | --- | --- |
| `GET /v1/health` | No body or session required | `{"ok":true,"api":"v1","enabled":true,"catalogHash":"<64 hex>","guards":{"killSwitch":{"enabled":true,"source":"default"},"breaker":{"state":"closed","failures":0,"trips":0,"retryAt":null}}}` | Reports guard state only; it contains no prompt or caller data. |
| `POST /v1/session` | No required fields; body is ignored | `{"token":"<signed session token>"}` when the worker has `AGENT_SESSION_SECRET`, otherwise `{"token":null}` | The local Node server does not configure a signing secret. |
| `GET /v1/receipts` | Worker: `Authorization: Bearer <token>`; local Node: caller IP identifies the session | `{"receipts":[<ActionReceipt>,...]}` | Lists action receipts for that session only. |
| `POST /v1/draft` | JSON below | `DraftResult` below, or `AgentEvent` frames when `Accept: text/event-stream` | Worker requires a valid bearer session token and a configured signing secret; local dev may use IP identity when no secret is configured. |

Draft request:

```json
{
  "prompt": "Build a quarterly summary for the fictional team at example.com",
  "catalogHash": "<the current 64-character catalog build hash>",
  "history": [{ "role": "user", "text": "Use the fictional sample figures." }],
  "draft": {
    "id": "layout-doc",
    "props": { "title": "Quarterly summary" },
    "children": [
      { "id": "blocks-text", "props": { "block": { "type": "heading", "level": 2, "text": "Highlights" } } }
    ]
  }
}
```

`history` and `draft` are optional. Unknown top-level or history fields are
rejected. The raw body limit is 64 KiB, prompt limit is 4,096 characters,
history is reduced to the last six turns, and each history text is limited to
4,096 characters. The request hash must match the service catalog hash or the
request receives `409 catalog-mismatch`. Incoming drafts are fully re-validated
as untrusted before the provider sees them.

Successful and invalid model attempts return a `DraftResult`:

```json
{
  "status": "valid",
  "draft": {
    "id": "layout-doc",
    "props": { "title": "Quarterly summary" },
    "children": [
      { "id": "blocks-text", "props": { "block": { "type": "heading", "level": 2, "text": "Highlights" } } }
    ]
  },
  "envelope": {
    "format": "texuli-blueprint",
    "version": 1,
    "id": "draft-<request id>",
    "catalog": "<64 hex>",
    "status": "draft",
    "createdAt": "<ISO timestamp>",
    "updatedAt": "<ISO timestamp>",
    "generator": { "kind": "agent", "name": "texuli.com agent", "model": "replay/fake" },
    "tree": {
      "id": "layout-doc",
      "props": { "title": "Quarterly summary" },
      "children": [
        { "id": "blocks-text", "props": { "block": { "type": "heading", "level": 2, "text": "Highlights" } } }
      ]
    }
  },
  "diagnostics": [],
  "receipt": {
    "id": "<request id>",
    "artifactKind": "blueprint-draft",
    "catalogHash": "<64 hex>",
    "tiers": { "providerOutput": "untrusted", "validation": "untrusted" },
    "durationMs": 12,
    "at": "<ISO timestamp>",
    "attempts": 1,
    "checks": { "limits": "passed", "renderer": "passed" },
    "model": "replay/fake",
    "timing": { "totalMs": 12, "gateMs": 2 },
    "usage": { "inputTokens": 20, "outputTokens": 30 }
  },
  "note": "Here is a validated draft."
}
```

The fields above show the shape; durations, timestamps, check keys and token
counts vary. `draft` is present only for `status: "valid"`; invalid attempts
carry diagnostics and an `artifactKind: "draft-attempt"` receipt. The envelope
status is a draft lifecycle value, not activation authority. The caller must
render the returned data again in the untrusted tier.

HTTP errors use `{"error":"<code>","message":"<plain text>","receipt":{...}}`
with `receipt` present for guard refusals. Statuses include `400` malformed
request, `401` missing/invalid worker session, `403` disallowed origin, `409`
catalog mismatch, `413` body or prompt too large, `422` invalid incoming draft,
`429` rate/token ceiling or occupied session, `502` provider failure, and `503`
disabled service, unavailable counter/storage, or open breaker. Unknown routes
are `404`; wrong methods are `405`. A receipt with `retryAfterMs` also sets
`Retry-After` in seconds. During SSE, errors arrive as an `error` event after
the stream has been opened, so the HTTP status remains `200`.

### SSE protocol

Send `Accept: text/event-stream`. Each frame is:

```text
event: accepted
data: {"type":"accepted","requestId":"<request id>"}

```

The server emits `accepted`, optional plain-text `generating`, `validating`,
optional `repairing` with stable diagnostic codes, and then `result` followed
by `done`; refusal or failure uses `error` followed by `done`. The `result`
event contains the same `DraftResult` shape as JSON mode. Partial trees are
never streamed. The stream reads provider progress on demand, and cancellation
aborts the provider request.

## Receipts and guard stack

There are two receipt kinds. A final `result` has a privacy-safe action receipt
with artifact kind, catalog hash, untrusted tiers, duration, timestamp and
attempt count. The full `DraftResult.receipt` adds validation checks, provider
label, timing, and provider-reported usage. Neither contains prompt text, IP,
session ID, or caller data. `GET /v1/receipts` returns only the action receipts
for the current session; local memory receipts can disappear on process restart
and worker memory receipts can disappear with an isolate. With the optional
`AGENT_DRAFTS` KV binding, draft and action receipt persistence is stored by a
one-way session hash.

`GuardReceipt` is different: it explains a live refusal and is included inline
in the error event or HTTP error body. Its `guard` is `kill-switch`,
`circuit-breaker`, or `token-budget`; it includes the catalog hash, refusal
time, provider attempt count and, when relevant, source, breaker state, retry
delay, or budget scope/limit/usage. Guard receipts are not added to
`GET /v1/receipts`. Request-rate and in-flight `busy` refusals have no
`GuardReceipt`.

The protections run in this order:

1. **Origin and route checks** reject an unapproved browser origin or unknown
   path/method.
2. **Kill switch** can reject the request before its body is read. The service
   checks it again before every provider call, including repairs.
3. **Admission** reads at most 64 KiB, strictly validates the JSON shape and
   catalog hash, and re-validates any incoming draft as untrusted.
4. **Request counters** use fixed windows: 5 requests per IP/minute, 60 per
   IP/hour, 20 per session/hour, and 2,000 total requests/day by default.
   Per-IP/session exhaustion returns `429`; the global daily request cap
   returns `503`. These are in-memory counters per service instance today.
5. **Concurrency** allows one active draft per session; a second gets `429
   busy`.
6. **Reported-token ceilings** default to 100,000 per session/day and
   1,000,000 globally/day, with UTC midnight reset. The provider's input and
   output usage events are counted. Exceeding a ceiling returns `429` and a
   `token-budget` receipt. When a usage event crosses the ceiling, that event
   is retained, but the current draft or repair result is withheld. Default
   counters are in memory per service instance (per worker isolate); the worker
   can be given a host-shared atomic usage store, but deployment-wide storage
   is not configured here. Providers that omit usage events cannot be
   accounted by token count.
7. **Provider circuit breaker** opens after three consecutive provider
   failures. It refuses calls for 30 seconds, then allows one half-open trial;
   success closes it and failure opens it again. Client aborts and token-budget
   refusals are not provider failures. Breaker state is in memory per service
   instance.

To configure provider-token ceilings, set `AGENT_TOKEN_BUDGETS` to JSON text:

```json
{"perSessionDailyTokens":20000,"globalDailyTokens":200000}
```

The Node adapter also reads the same values under `tokenBudgets` in
`~/.config/texuli/agent.json`; environment JSON takes precedence. For the
documented illustrative accounting only, one reported token equals one
fictional budget unit. This is not money or a provider price; there is no
pricing API. See the [README token-ceiling note](../README.md#token-ceilings).

## Key-store boundary

No real provider adapter exists. A key is not needed for local development or
tests. `AGENT_PROVIDER_KEY` and `AGENT_PROVIDER` may be passed from the shell
to the Node adapter or from the platform secret binding to the worker, and the
Node adapter can read the provider block from
`~/.config/texuli/agent.json`. No adapter consumes the resolved key today: the
replay provider still answers. The key is never read from `.env`, returned in
API responses, or logged as a value. Do not place a key in this repository.
See [provider key storage](key-store.md) for the exact resolution boundary.

## Local development and evals

From the repository root, run the local Node adapter:

```bash
pnpm --filter @texuli/agent dev
```

It serves `http://localhost:8787` by default. It uses the replay provider,
requires no key, and does not call an external provider. `GET /v1/health` is
available without a session; a local draft is keyed to the caller IP because
the local adapter does not set `AGENT_SESSION_SECRET`. The server reads only
the operator config path described in [key-store.md](key-store.md), and never
reads repository `.env` files.

The offline eval harness replays eight golden audit fixtures through the
shared HTTP handler and writes its report under ignored `tmp/`:

```bash
pnpm exec tsx apps/agent/evals/run.ts
```

It proves the replay and validation path, not model quality. See
[eval harness details](evals.md). The focused operational checks and full
service test suite are:

```bash
pnpm --filter @texuli/agent exec vitest run tests/guard.test.ts
pnpm --filter @texuli/agent exec vitest run tests/http.test.ts
pnpm --filter @texuli/agent exec vitest run tests/keys.test.ts
pnpm --filter @texuli/agent exec vitest run tests/hostile-worker.test.ts
pnpm --filter @texuli/agent exec vitest run
pnpm --filter @texuli/agent typecheck
```

## Deployment contract: website CSP and worker

Nothing is deployed. The website's production build writes per-route policies
to `dist/_headers` and `dist/csp-manifest.json`; Astro dev and preview do not
apply those response headers. Read the website's
[CSP host contract](../../website/docs/site-csp.md) before any deployment.
The static host must send the exact enforcing and report-only policy strings
from `csp-manifest.json` on every HTML route. Hashes are page-specific; do not
edit or regenerate policies by hand. The website CSP currently permits
same-origin connections only. A future agent origin must be explicitly added
to `connect-src`, rebuilt and re-verified before the browser can call it.

The service currently has no chosen hosting platform, worker project, session
secret, persistent request-counter backend, or deploy config. A deployment
would need a randomly generated `AGENT_SESSION_SECRET` of at least 32 UTF-8
bytes, a trusted IP source, allowed website origin, durable/shared quota stores
if global enforcement is required, and an approved provider/key before a real
adapter can be connected. The worker refuses session/draft/receipt routes when
the signing secret is missing or too short. These are preconditions, not
completed setup. Deploying either the worker or website is a developer-GO
action.

## Incident playbook

The procedures below describe the current local behavior and the future
operator checks; there is no live service to operate today.

1. **Check service and breaker:** request `GET /v1/health`. Read `enabled`,
   `guards.killSwitch`, and `guards.breaker`. Health never returns prompts or
   receipts. No administrative breaker-reset route exists.
2. **Investigate an open breaker:** it opens after three consecutive provider
   exceptions. The refusal body or SSE error carries a `circuit-breaker`
   receipt with failures, trips, retry time and attempt count. Wait for its
   30-second cooldown; one request gets the half-open trial. A successful
   provider response closes it. With the current replay provider, real
   provider failure incidents cannot occur; the behavior is exercised by
   fake-provider tests.
3. **Inspect receipts:** use `GET /v1/receipts` with the same session token
   (or same caller IP in local mode) to inspect final artifact action receipts.
   A refusal's `GuardReceipt` appears only in that refusal's HTTP body or SSE
   error frame; it is not persisted. Receipts contain metadata, not prompts.
4. **Stop generation:** in the Node adapter, set `{"enabled":false}` in the
   operator config. This local `false` overrides even `AGENT_ENABLED=1` and
   takes effect as the settings are re-read. To resume, remove that override
   and set the desired environment value. On the worker, there is no local
   file: `AGENT_ENABLED` must equal `"1"` to enable; unset it or set another
   value to disable. The kill switch is checked before each generation and
   repair call.
5. **Handle token ceiling refusals:** a `token-budget` receipt names the
   session/global scope and reported usage. Wait for the UTC daily reset or
   change the configured ceiling through the approved operator path. No
   request or token counters are exposed through health.

All sample content above uses fictional identifiers and data.
