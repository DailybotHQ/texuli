# Hostile chart input corpus

Chart data can come from an agent or a user. Every chart family must either
draw finite geometry or reject the input with a `TypeError` naming it. It
must never overflow the stack, allocate without bound, write `NaN` or
`Infinity` into SVG attributes, or render a label as markup.

| File | What it holds |
| --- | --- |
| `corpus.ts` | The samples, test-only: hostile value arrays (empty, gaps, `NaN`/`±Infinity`, ±1e308, subnormals, wrong types, sparse holes, 300,000 values), hostile labels (markup, `javascript:`, bidi override, zero-width, 10,000 characters), hostile groups (null, blank, `__proto__`, duplicate ids, 500 extras) and hostile options (`NaN`/negative/infinite sizes, reversed or degenerate domains, a billion density points), plus the `nonFiniteLeaves` geometry check |
| `statistical.hostile.test.ts` | `@texuli/charts/statistical` against every sample: summaries, layouts and components |
| `families.hostile.test.ts` | Existing families (histogram and `bin`, calendar and geo color scales, funnel, pie, LTTB, cartesian, matrix, sparkline) |

Fictional data only (`phish.example`).

## Gaps found and fixed

The first corpus run pinned these as `it.fails` KNOWN cases. They are fixed
now, and the pins are plain passing tests:

| Gap | Fix |
| --- | --- |
| `bin`, `createHistogramLayout`, `calendarColorIndex`, `geoColorIndex`, `funnelLayout`, `Sparkline` and `GeoPointMap` threw `RangeError: Maximum call stack size exceeded` on 300,000 values | `Math.min(...values)` / `Math.max(...values)` became one iterative scan (`extent`) |
| `bin` threw `RangeError: Invalid array length` for `[-1e308, 1e308]` and for `count: 1e9` | `count` is capped at `MAX_BINS` (1,000), and a span too wide for a finite tick step becomes one bin |
| A `NaN` histogram `domain` edge wrote `NaN` into bar geometry | A domain with a non-finite edge is ignored; histogram, calendar and geo positions use halved terms so `max - min` cannot overflow |

A 300,000-value `Sparkline` used to exhaust a test worker's memory, with one
table row and one bar per value. It now draws at most 2,000 bucket samples
and windows its table, and the corpus renders it at full size.

The statistical subpath has none of these gaps: its own corpus run found a
subnormal-bandwidth overflow in `kernelDensity`, which is fixed and covered.

```bash
pnpm vitest run packages/charts/tests/hostile
```
