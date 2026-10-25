# Blueprint builder performance at scale

`tests/perf/builder-large-blueprints.test.ts` measures the texuli.com
blueprint builder (`apps/website/src/components/builder/`) on large
blueprints. Run it serially; it is kept out of the parallel unit suite
because machine load changes measured duration:

```sh
TEXULI_PERF=1 TEXULI_PERF_REPORT=1 pnpm vitest run tests/perf/builder-large-blueprints.test.ts --maxWorkers=1 --no-file-parallelism --silent=false
```

`pnpm test:perf` runs it with the other perf files. `TEXULI_PERF_REPORT=1`
prints one `[perf]` line per measurement; `--silent=false` keeps those lines
for passing tests.

## Workloads

Synthetic, fictional blueprints that pass the builder's own validation:

| Shape | Nodes | Depth | Built from |
| --- | ---: | ---: | --- |
| `wide-100` | 100 | 3 | a page of cards, 15 leaves each (text blocks and gauges) |
| `wide-500` | 500 | 3 | same |
| `wide-512` | 512 | 3 | same, at the catalog tree limit (`maxNodes` 512) |
| `deep-512` | 478 | 16 | cards nested to the depth limit, leaves on every level |
| `wide-1000` | 1000 | 3 | past the node limit: the builder refuses it, so only the pure walks run |

The edit target is the last gauge in reading order (the deepest node with a
`label` prop). Each measurement warms up and takes the best of three, except
the typing burst and the preview's first paint, which are single timed
runs. Budgets use the same calibration as the other perf files: a native
100,000-number sort in the same process.

## Results

Local serial run, Node 26.11.1, 2026-10-25, branch `p004/p4-b-perf` on dev
`3b6d101a`, calibration sort 11.9 ms. The preview rows run the real player
(`mountPlayer` with `PLAYER_LOADERS`) in happy-dom, not in a browser.

| Path (runs on) | wide-100 | wide-500 | wide-512 | deep-512 | wide-1000 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `flattenTree` (every tree change) | 0.01 ms | 0.04 ms | 0.02 ms | 0.02 ms | 0.03 ms |
| `outlineRows` (every tree change) | 0.05 ms | 0.12 ms | 0.10 ms | 0.12 ms | 0.20 ms |
| canonical JSON | 0.15 ms | 0.85 ms | 0.47 ms | 0.45 ms | 0.83 ms |
| payload pretty JSON (every tree change) | 0.16 ms | 0.77 ms | 0.79 ms | 0.92 ms | 1.44 ms |
| history apply with the commit gate (every keystroke) | 0.16 ms | 0.61 ms | 0.66 ms | 0.71 ms | refused |
| digest (SHA-256 of canonical JSON) | 0.16 ms | 0.51 ms | 0.50 ms | 0.45 ms | — |
| payload commit check (whole text) | 0.70 ms | 3.41 ms | 3.38 ms | 5.37 ms | — |
| outline move guard (both trees validated) | 0.80 ms | 2.87 ms | 2.53 ms | 2.39 ms | — |
| preview live update (R20), one prop edit | 16.2 ms | 66.2 ms | 69.0 ms | 69.5 ms | — |
| preview first paint | 219 ms | 463 ms | 545 ms | 597 ms | — |

Typing burst on `wide-512`, 3,000 keystrokes coalesced into one undo step:
keystrokes 50–550 took 275 ms, keystrokes 2,500–3,000 took 352 ms (336 and
324 ms in the run before the fix below, which does not touch this path).
The cost per keystroke stays flat as the coalesced step grows, so
coalescing is linear; the test asserts the last 500 cost under 2.5× the
first 500.

## Fixed: placing payload issues was quadratic

A refused payload text places each issue at a line and column. Each
placement rescanned the text from the start (`positionAt`), so placing one
issue per node scaled with issues × text length. `checkPayloadText` now
builds the line starts once and binary-searches them (`positionIndex`), with
the same positions (a unit test compares both at every offset of several
texts).

| `wide-512`, an unknown prop on every node (97 KB, 512 issues) | Time |
| --- | ---: |
| Before (dev `3b6d101a`) | 53.9 ms |
| After | 3.7 ms |

The perf test asserts that placing the 512 issues costs under 4× a clean
check of the same tree. On the old code it failed (55.1 ms against a
19.6 ms limit); with the fix it passes.

## Findings not changed here

- **The preview's live update is the largest per-keystroke cost.** About
  69 ms at 512 nodes and 16 ms at 100 in happy-dom, growing linearly. It is
  inside `@texuli/player` (the player re-validates and re-plans the whole
  tree on every update, as R20 specifies; painters stay loaded). Draft
  validation alone is about 1.3 ms at 512 nodes (half the move guard), so
  most of the time is the re-render. Options for the player and builder
  owners, not applied: coalesce preview updates to one per animation frame
  in the builder (the preview would skip intermediate keystrokes, never the
  last), or reuse unchanged node plans in the player. Browser numbers are
  **not measured**; happy-dom is not a browser.
- **Nothing else is quadratic.** Every other path above grows linearly and
  stays under 6 ms at the node limit.

## Not covered

Browser timings (the builder spec runs in Playwright but measures no
durations), memory held by a long undo history, and the inspector widgets'
own rendering.
