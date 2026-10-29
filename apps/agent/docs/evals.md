# Agent service: offline eval harness

**Status: the offline harnesses run today. Real-provider evals are planned, not
built.** No key, no network and no provider account are involved: both
harnesses use the replay provider (`src/provider.ts`) unless a caller passes
another `Provider`, and no script in the repository builds a real one.

## What it does

`evals/harness.ts` drives the full HTTP handler (`POST /v1/draft`, the same
code the edge worker runs) across the eight golden audit fixtures in
[`tests/fixtures/golden`](../../../tests/fixtures/golden/README.md), which it
only reads. For each fixture the replay provider answers the fixture's
`screen` description with the fixture's `tree` as the `emit_blueprint` call,
and the harness scores the result against `golden-expectations.json`:

| Check | A fixture expected `valid` | A fixture expected `invalid` |
| --- | --- | --- |
| Outcome | The service returns a `valid` draft | The service returns `invalid` |
| Diagnostics | Zero diagnostics | At least one diagnostic |
| Counts | Draft nodes equal the pinned `nodes`; re-rendered in the untrusted tier, components equal the pinned `components` and placeholders are 0 | No draft is returned |

The expected outcome comes from the pinned untrusted-tier render: a fixture is
expected `valid` only when it renders in the untrusted tier with no codes, no
placeholders and no sinks. Today that is fixtures 01, 02 and 05 to 08.
Fixtures 03 and 04 are developer-tier app chrome (`form`, `input`, `stepper`
and similar), which the agent's untrusted gate rejects as `tier-denied`.

## Running it

```bash
pnpm exec tsx apps/agent/evals/run.ts
```

It prints one `PASS` or `FAIL` line per fixture and writes the summary to
`tmp/agent-evals/golden-summary.json` at the repository root. `tmp/` is
git-ignored, so the artifact is never committed. The exit code is 1 when any
fixture fails. There is no CI wiring; this is a local command.

The summary is deterministic: fixtures in file order, sorted diagnostic
codes, a fixed clock and request ids, and no timestamps or timings. Two runs
on the same code produce byte-identical files (`tests/eval-harness.test.ts`
checks this).

```json
{
  "harness": "agent-golden-eval/v1",
  "provider": "replay/fake",
  "catalogHash": "<64 hex>",
  "catalogEntries": { "pinned": 162, "actual": 162 },
  "fixtures": [
    {
      "id": "01-landing-page",
      "expected": "valid",
      "status": "valid",
      "diagnostics": 0,
      "nodes": { "expected": 16, "actual": 16 },
      "checks": { "outcome": true, "diagnostics": true, "counts": true },
      "pass": true
    }
  ],
  "totals": { "fixtures": 8, "passed": 8, "failed": 0 }
}
```

(Abridged: each fixture also records its tier, error code, attempts,
diagnostic codes, components and placeholders.)

## The streaming harness

`evals/stream-harness.ts` (`runStreamEval`) runs a provider over the golden
set through the streaming endpoint (`POST /v1/draft` with `"stream": true`,
read as server-sent events, [streaming.md](streaming.md)) and measures:

| Measure | Per case | Totals |
| --- | --- | --- |
| Validity | `status` (`valid`, `invalid`, `error`), `pass` against the pinned outcome | `valid`, `invalid`, `errors`, `validityRate`, `matched` of `pinned` |
| Refusal reasons | `diagnosticCodes` of the final verdict, `streamRefusals` seen node by node, `nodesReady`, `nodesRefused` (summed over attempts) | `refusalReasons`: final codes with counts |
| Time to first node | `timeToFirstNodeMs`: request to the first `node-ready` frame | median, p95, max |
| Total time | `totalMs`: request to the last frame | median, p95, max |

The cases are the eight golden audit fixtures (with their pinned outcome)
and the spec's golden blueprints in
[`packages/spec/fixtures/golden`](../../../packages/spec/fixtures/golden),
whose trees are measured only: they use state, bindings and flows that a
bare `emit_blueprint` tree does not declare, so most are refused for that.

By default the fake provider streams each tree as `tool-delta` pieces
(sizes 24, 7, 61, cycling) with 15 ms before each event, on a **virtual
clock**: waits advance the clock and nothing sleeps, so the report is
deterministic (CI-like mode, `tests/stream-eval.test.ts` compares two runs
byte for byte). The times are then the fake latency the stream would take,
not a model's speed. `--wall` uses real timers.

```bash
pnpm exec tsx apps/agent/evals/stream-run.ts
pnpm exec tsx apps/agent/evals/stream-run.ts --wall
```

It prints one line per case (`PASS`, `FAIL` or `MEASURED`) and writes
`tmp/agent-evals/stream-report.json` (`agent-stream-eval/v1`). The exit code
is 1 when a pinned case misses its outcome. A developer who wants
real-provider numbers calls `runStreamEval({ catalog, catalogHash, provider })`
from their own script with an adapter they construct
([providers.md](providers.md)); that is a developer step, not done here.

## What it does and does not prove

- It tests the **service code**: admission, the validation gate, the repair
  loop's first attempt and the receipt. A replayed tree is the fixture itself,
  so it does not measure a model.
- `tests/eval-harness.test.ts` also proves the harness catches a regressing
  model, using fake providers that drop nodes, add a tier-denied component or
  never call the tool.
- The golden set's own drift gate stays where it is:
  `pnpm exec tsx tests/fixtures/golden/run-golden-fixtures.mts` checks the
  catalog against the same expectations without the agent service.

## Planned, not done

- **Real-provider evals** (agent-service design §9): a developer-run script
  that sends the briefs through a real adapter with a key read at run time
  from outside the repository (`docs/key-store.md`), saves the trees, and
  scores them with these harnesses plus `texuli-golden` and an `axe` check.
  It stays report-only, with results recorded by date and model label. The
  adapters exist ([providers.md](providers.md)) and `runStreamEval` accepts
  one, but no such script exists and no adapter has called a provider.
- Running the 30 `@texuli/tools/golden` briefs through this harness (today
  `tests/evals.test.ts` replays them inside the test suite only).
- CI wiring.
