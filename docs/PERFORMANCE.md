# Performance — Texuli

Two kinds of numbers live here: **measured** numbers from this repository
(with the date and command), and **planned** budgets that no check enforces
yet. Never move a planned budget into the measured table without running it.

## Measured today (2026-10-24)

On dev at `10a44f98`, on a shared machine under heavy load (load average
about 100), so wall times are upper bounds.

| What | Value | How it was measured |
| --- | --- | --- |
| `pnpm check` wall time | about 3 min 34 s (exit 1: one known test failure, see TESTING_GUIDE) | `time pnpm check` |
| `pnpm build` wall time | about 99 s (`astro check` then the static build) | `time pnpm build` |
| `astro check` (website) | about 23 s, 161 files, 0 errors | `time pnpm --filter @texuli/website typecheck` |
| Website `index.html` | 70,613 B (14,457 B gzip) | `wc -c` and `gzip -9 -c … \| wc -c` on `apps/website/dist/index.html` |
| Scripts the landing references directly | 6 modules, 6,810 B gzip; their imports bring the page's JS to about 113 KB gzip (`site-perf.spec.ts`, 2026-10-23) | `grep -o '_astro/[^"]*\.js' apps/website/dist/index.html` |
| Core unit tests | 22 files, 322 tests in about 6 s | `pnpm vitest run packages/core` |

### Website assets (2026-10-26, PLAN_006 T-92)

On dev after `f2a49551` with other lanes' uncommitted work present. Details
and per-file numbers: the T-92 walk in the PLAN_006 plan folder
(`analysis_results/walks/perf-assets.md`).

| What | Value | How it was measured |
| --- | --- | --- |
| Checked-in brand and demo PNGs (17 files) | 67,933 B → 50,499 B, lossless (decoded pixels identical) | Sharp re-encode; RGBA comparison against `git show HEAD:<file>` |
| Brand WebP copies (10 files, each with a PNG fallback in `<picture>`) | 24,982 B total | file sizes in `apps/website/dist/brand/` |
| Header logo per page (gzip -9) | 3,754 B PNG → 1,149 B WebP on 1x screens (2,333 B on 2x, 3,275 B on 3x) | `gzip -9 -c <file> \| wc -c` |
| Route page weight (site-perf method, Chromium 1x) | 2.5 to 2.6 KB lighter on every route with the header; `/web-and-native/` 96.6 → 94.1 KB (budget 96) | `tests/e2e/site-perf.spec.ts` (10 passed), same measurement as a script |
| Font files and `@font-face` rules in the build | 0 and 0: system font stacks, no font requests | `find apps/website/dist -name '*.woff*'`; `grep -l '@font-face' apps/website/dist/_astro/*.css` |
| OG images (398 PNG, 1200 px) | 12,712,517 B at Sharp palette effort 8 (effort 10: 838 B larger, 4.6 s slower, not adopted) | every page's OG SVG encoded at both settings |

### Charts large-data limits (2026-10-24)

`TEXULI_PERF_REPORT=1 pnpm test:perf` on the lane worktree for task 106, one
local run, best of three per case. The calibration baseline (a native 100k
`Float64Array` sort) took 10.6 ms. Budgets scale with that baseline.

| Case | Measured | Budget | Output bound |
| --- | --- | --- | --- |
| `sparklineGeometry`, 1M values with gaps | 98.3 ms | max(400 ms, 40× baseline) | at most 2,001 drawn points |
| `createHistogramLayout`, 1M values, `count: 1e9` | 86.5 ms | max(400 ms, 30× baseline) | at most 1,000 bins |
| Box, violin and ECDF layouts, 4 groups × 100k values | 278.6 ms (790.8 ms before each group was sorted once on a typed array) | max(1,000 ms, 80× baseline) | ECDF path under 4 MB |
| `lttbIndices`, 1M → 2k | 9.2 ms | max(150 ms, 15× baseline) | exactly 2,000 indices |
| `appendSeriesWindow`, 1,000 batches of 100 points | 64.9 ms | max(500 ms, 40× baseline) | 10,000-point window |

Worker offload (task 108, 2026-10-25, a separate run on a heavily loaded
machine with load average about 195 and a 128.6 ms baseline, so these are
upper bounds): binning plus LTTB of 1M values through a `MessageChannel`
stand-in for the worker took 751.4 ms, and the main-thread fallback bin took
426.8 ms. The channel runs in the same thread, so this measures the packing
and transfer overhead, not the main-thread time a real browser worker saves.
That is not measured yet.

A 300,000-value `Sparkline` used to exhaust a test worker's memory (one table
row and one bar per value). It now renders bounded marks and a windowed table,
which `packages/charts/tests/hostile/families.hostile.test.ts` checks.

### PLAN_004 surface limits (2026-10-25)

`tests/perf/plan004-surfaces.test.ts`, run with `TEXULI_PERF_REPORT=1 pnpm
test:perf` in the lane worktree for task 185, one local run under load
(load average about 45), best of three per case. The calibration baseline (a
native 100k `Float64Array` sort) took 11.0 ms; budgets scale with it.

| Surface | Case | Measured | Budget |
| --- | --- | --- | --- |
| Player flows | `nextFlowView`, 100k events on a 16-view, 64-transition flow (half guarded) | 61.5 ms | max(400 ms, 40× baseline) |
| Player local state | `resolveStateBindings` on a 512-node blueprint, 50 times | 46.0 ms | max(400 ms, 40× baseline) |
| Media composition v2 | `sampleCompositionV2` of the golden lower third at 60 fps (360 frames) | 6.4 ms | max(300 ms, 30× baseline) |
| Media composition v2 | `validateCompositionV2` of a 256-node tree (the maximum), 20 times | 8.1 ms | max(400 ms, 40× baseline) |
| Media timeline | 1,000 edits through `timelineHistoryReducer`; undo history stays at most 100 | 9.5 ms | max(500 ms, 50× baseline) |
| Media export queue | `exportQueue`, 100 SVG exports of the flattened golden; 100 receipts | 6.8 ms | max(1,000 ms, 80× baseline) |
| Catalog conditions | `parseWhen` plus `formulaConditions.evaluate`, 10k times | 44.2 ms | max(400 ms, 40× baseline) |
| Catalog paint policy | `paintProps` over 1,000 `srcset` props with 8 candidates each; 20 hostile values removed | 12.8 ms | max(400 ms, 40× baseline) |
| Charts formats | `formatChartValue`, 100k values across number, currency and date specs | 80.0 ms | max(1,000 ms, 80× baseline) |

The charts case found a real cost: `formatChartValue` built a new `Intl`
formatter for every value, and 100k values took 8,499 ms. It now keeps one
formatter per spec (at most 64 specs), and the same case takes 80 to 128 ms
across runs.

Notes and gaps:

- The export queue's exporters take flat v1 compositions: a v2 document must
  be flattened with `compositionLeaves` first (a v2 input fails as `invalid`).
  Only the SVG exporter is measured. PNG and WebM need a canvas and a media
  recorder, which the node perf suite does not have: **planned**.
- These are function-level limits. Rendering cost of the player's Svelte flow
  views, controls and regions, and of the timeline editor, is not measured:
  **planned**.
- In one full-suite run, the existing "cascades a 2k-task schedule" case
  (`data-grid-charts-media.test.ts`) failed under load and passed on two
  isolated reruns and the next full run.

## Hot paths (planned)

- **Overlay open to focus** (dialog, popover, menu): the layer stack, focus
  move and scroll lock run on every open.
- **Typeahead and roving focus** on long lists and menus.
- **Data views** (grid, tree, virtual list) rendering thousands of rows.
- **Catalog validation** before rendering agent output, which runs per
  response.

## Size budgets (enforced by `pnpm size`)

`scripts/size.ts` builds every export subpath of every package on its own
with Vite, the way a consumer imports it (`export * from '<entry>'`, minified,
`svelte` external, every other import bundled, workspace packages included).
It measures the entry's **initial** JavaScript (the entry chunk and what it
imports statically) with gzip -9 and brotli 11, the CSS it emits with gzip, and
reports chunks reached only through `import()` as lazy gzip without budgeting
them. Each result is compared with `texuli.budgets.json`; the run fails when an
entry is over budget, has no budget, or is larger than the Protoyard package it
replaces.

```sh
pnpm exec tsx scripts/size.ts                       # the table; exit 1 over budget
pnpm exec tsx scripts/size.ts --filter primitives   # a subset, by id
pnpm exec tsx scripts/size.ts --json                # machine-readable
pnpm exec tsx scripts/size.ts --update              # tighten exact budgets to the measure
pnpm exec tsx scripts/size.ts --protoyard ../protoyard   # re-measure the Protoyard baselines
```

`pnpm size` is the same script (the root `size` script); `pnpm size --json`
and `pnpm size --filter <id>` pass the flags through.

**Budgets only shrink.** `--update` lowers an exact budget to the measured size
rounded up to 64 B and never raises one. A budget grows, or a new entry gets
one, only with `--update --allow-grow`, and the report says why.
`texuli.budgets.json` is owner-held; each budget carries a note with its
reason. Pattern budgets (`@texuli/primitives/*`) are defaults for entries
without an exact budget and never change through `--update`.

| Budget (from `texuli.budgets.json`) | gzip B | Measured 2026-10-24 (gzip B) |
| --- | ---: | ---: |
| A primitive (`@texuli/primitives/*`, default; CSS 1,024) | 4,096 | per entry |
| Dialog (`@texuli/primitives/dialog`) | 12,288 | 11,989 |
| Combobox (`@texuli/primitives/combobox`) | 24,576 | 16,099 |
| A texel (`@texuli/core/*`, default) | 4,096 | per entry |
| A styled subpath (`texuli/*`), data view (`@texuli/data/*`) or media entry (`@texuli/media/*`), default | 12,288 | per entry |
| `texuli` (root; ceiling: `@protoyard/ui` measured 217,881) | 217,920 | 197,028 |
| `@texuli/tokens` (root; ceiling: `@protoyard/themes` measured 50,832) | 50,880 | 40,369 |
| `@texuli/core` (root barrel) | 24,576 | 22,972 |
| `@texuli/primitives` (root barrel) | 131,072 | 111,104 |
| `@texuli/data` (root barrel) | 81,920 | 63,668 |
| `@texuli/media` (root barrel) | 49,152 | 37,356 |
| `@texuli/catalog` (root barrel) | 49,152 | 45,767 |
| `@texuli/blocks` (root barrel) | 32,768 | 27,924 |
| `@texuli/charts` (root) | 16,384 | 12,178 |
| `@texuli/chat` (root) | 16,384 | 10,672 |
| `@texuli/catalog/manifest` | 8,192 | 4,112 |

**Measured 2026-10-24** (`pnpm size` on dev at `10a44f98`, 251 entries,
about 1 min 45 s): 250 pass and one fails, `@texuli/tokens/aa-gate` at
10,817 B gzip against its 10,624 B budget. Consumers import per-entry
subpaths, so the root barrels are convenience aggregates, not first-load
costs. The Protoyard baselines were measured at Protoyard `c73e0445` with
`pnpm exec tsx scripts/size.ts --protoyard ../protoyard`. A Protoyard number is
that package's whole barrel (`export *`), so it is a ceiling, not a target.

## Planned budgets (not enforced yet)

| Budget | Target |
| --- | --- |
| Dialog open-to-focus | p75 ≤ 50 ms (`tests/behavior/harness/limits.ts`, asserted with `TEXULI_PERF=1`) |
| Website pages | ship no client JavaScript unless the page has an interactive example |
