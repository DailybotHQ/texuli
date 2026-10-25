# Agent service: offline eval harness

**Status: the offline harness runs today. Real-provider evals are planned, not
built.** No key, no network and no provider account are involved: the harness
uses the replay provider (`src/provider.ts`) only.

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
  "catalogEntries": { "pinned": 132, "actual": 132 },
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
  scores them with this harness plus `texuli-golden` and an `axe` check. It
  stays report-only, with results recorded by date and model label. No real
  adapter exists yet.
- Running the 30 `@texuli/tools/golden` briefs through this harness (today
  `tests/evals.test.ts` replays them inside the test suite only).
- CI wiring.
