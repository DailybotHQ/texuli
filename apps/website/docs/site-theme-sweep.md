# Theme sweep tooling

**Code:** `scripts/theme-sweep.ts` (library, no CLI)
**Tests:** `scripts/tests/theme-sweep.test.ts`
**Tasks:** PLAN_006 T-76 (helpers), T-77 (first run and triage)

## Purpose

The site shows every example in 200+ token themes, light and dark. The
sweep is the deterministic way to ask "does each theme still hold its
contrast floors, resolve every semantic token and map forced colors?"
without hand-checking themes, and to write the answer as a stable
example × theme matrix that other lanes can triage. It complements the
visual baselines ([site-visual.md](site-visual.md)), which render a fixed
set of themes in a browser.

## Structure

`scripts/theme-sweep.ts` exports pure helpers:

| Export | Role |
| --- | --- |
| `THEME_SAMPLE_CONFIG` | The fixed 14-theme gamut sample (hue, tone and contrast spread, two AAA themes) |
| `loadThemeSample(full)`, `selectThemeSample` | The sample, validated against the live token library (`listFullThemeLibrary`), or the full catalog in stable id order |
| `selectExamples` | Sorted examples; duplicate or unsafe ids are rejected |
| `CONTRAST_FLOORS` | 4.5:1 normal text, 3:1 large text, 3:1 non-text UI |
| `evaluateThemeEvidence` | Turns captured signals into a cell: `pass`, `fail`, `incomplete` or `pending` (no evidence yet), with issues and evidence pointers |
| `buildThemeSweepReport`, `formatThemeSweepMarkdown` | The deterministic report object and its Markdown matrix |

The module decides policy and formats results; it does not render
anything. Evidence comes from whoever runs it.

## Ownership

`scripts/theme-sweep.ts` and its test belong to the scripts surface; the
contrast math and forced-colors role map it reads live in
`@texuli/tokens` (`packages/tokens/src/forced-colors/mapping.ts` for the
role map). Findings are routed in the plan, not fixed by the sweep.

## Spec map

| Behavior | Pinned by |
| --- | --- |
| Sample order and validation against the current manifest; full-catalog order | `scripts/tests/theme-sweep.test.ts` |
| Example sorting and id rejection | `scripts/tests/theme-sweep.test.ts` |
| Contrast, light/dark coverage, forced colors and unresolved tokens evaluated per cell | `scripts/tests/theme-sweep.test.ts` |
| Deterministic matrix with pending cells and evidence pointers | `scripts/tests/theme-sweep.test.ts` |

```bash
pnpm vitest run scripts/tests/theme-sweep.test.ts
```

## The recorded run (T-77, 2026-10-26)

A temporary static runner in the plan's scratch space (outside the
repository) fed the helpers token values only, without a browser:

| Scope | Themes | Cells | Red | Incomplete |
| --- | ---: | ---: | ---: | ---: |
| Sample | 14 | 14 | 0 | 0 |
| Full | 210 | 210 | 0 | 0 |

Each cell checked seven semantic pairs in both modes (foreground,
muted foreground, primary and destructive foregrounds, link, ring and
strong border against their surfaces): 2,940 pair checks in the full
matrix, all at or above their floor, with no unresolved variables and a
forced-colors mapping for every checked focus and state role.

## How to extend

- **Change the sample:** edit `THEME_SAMPLE_CONFIG`; the test fails if an
  id leaves the token library.
- **A new dimension** (another contrast pair, a new signal): extend the
  evidence type and `evaluateThemeEvidence`, and add a failing case to the
  test first.
- **Feed browser evidence:** pass captured signals per example and theme
  into `buildThemeSweepReport`; cells without evidence stay `pending`.

## Deviations and limits

- **No CLI.** The module has no command-line entry and no browser capture
  integration, so a run needs a small runner script. A durable CLI is
  planned, not shipped.
- **Static scope only.** The recorded run measured token values, not
  rendered pages: focus visibility after the browser cascade, keyboard
  and assistive technology, viewport behavior and component-level
  `color-mix()` compositions (for example the landing's highlighted
  `mark` and the agents band) were not measured and were routed to their
  owning lanes. A green matrix is not visual proof.
