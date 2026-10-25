# Primitives reference

**App:** `@texuli/website` (`apps/website`)
**Paths:** `/primitives-page/` (every primitive) and `/primitives-page/<id>/` (one per `@texuli/primitives` subpath)
**E2E:** `tests/e2e/site-primitives-page.spec.ts`

## Goal

A reference for the headless layer, `@texuli/primitives`: for each primitive, the parts and how they nest (an anatomy diagram), the WAI-ARIA pattern it follows, its size budget, and the behavior checks from the repository's behavior suite.

The pages are static. Everything is read when the site builds, and nothing is fetched when a page is served.

## What each page shows

- **Import:** the import line. Modules of plain named parts are imported as a namespace (`import * as Dialog from '@texuli/primitives/dialog'`); compound objects by name (`import { Tooltip } from '@texuli/primitives/tooltip'`).
- **Pattern:** the WAI-ARIA APG pattern, linked to its APG page when one exists. Primitives with no APG pattern (Avatar, Portal, Progress…) say what they are instead of linking.
- **Size budget:** the gzip budget of `@texuli/primitives/<id>` in `texuli.budgets.json`, from its exact entry or the `@texuli/primitives/*` pattern. It is a budget, not a measurement.
- **Anatomy:** nested boxes, one per part, each holding the parts inside it, with every part named as it is written in code (`Dialog.Content`, `Tooltip.Trigger`).
  - It is a `figure` with a nested list, so a screen reader hears the same structure the boxes show.
  - Notes cover variants (`DateRangePicker`, `Drawer`).
- **Behavior checks:** one of three kinds, read from the committed behavior suite:
  - **Rows:** the scenario in `tests/behavior/scenarios/<id>.spec.ts` runs its rows on Chromium, WebKit and the Pixel 7. The page lists every row (in a disclosure).
  - **Checks:** a spec of standalone browser tests (ColorPicker, ContextMenu, NumberField, Sheet, Splitter, TagsInput, Toolbar, Tree). The page lists the checks.
  - **Missing:** no scenario. None today.
  - **Limits:** the absolute limits the primitive is held to: every row passes, its gzip budget, and its open-to-focus p75 limit read from `tests/behavior/harness/limits.ts`.
  - **This is a snapshot of what the repository defines, not a CI result:** the page says what is checked, not that it passed.

The index lists every primitive as a card with its import path, pattern, part count and behavior summary. The `Primitives` link is in the site navigation (`src/components/foundation/site.ts`).

## Implementation

- **`src/components/primitives-page/primitives.ts`:** the data. There is one entry per subpath, holding the id, name, summary, APG pattern, anatomy tree, optional `namespace` and notes. It also exports `anatomyParts`, `importLine`, `partLabel` and `primitivePath`.
- **`src/components/primitives-page/behavior.ts`:** pure parsers for scenario rows (`id`, `title`), standalone test titles and the open-to-focus limits.
- **`src/components/primitives-page/sources.ts`:** inlines the scenario specs, the suite's `limits.ts` and `texuli.budgets.json` at build time (`import.meta.glob(..., { query: '?raw' })` and a JSON import).
- **`AnatomyDiagram.astro`** (recursive) and **`BehaviorChecks.astro`:** the two sections.
- **`src/pages/primitives-page/index.astro`** and **`[id].astro`:** the pages.

## Keeping it honest

The spec fails when the data drifts from the code:
- **Coverage:** every `@texuli/primitives` subpath has exactly one entry, and nothing more.
- **Anatomy:** every part resolves against the subpath's real exports. The spec reads compound objects (`export const Tooltip = { … }`), named exports, and `export * as` / `export *`. A part that does not exist fails the build check; I confirmed this by injecting a bogus part.
- **Parser:** for every committed scenario it finds as many rows as the file contains, each with a title.
- **Limits:** the parsed open-to-focus limits equal the suite's own exports.

When you add a primitive, add its entry (and anatomy) to `primitives.ts`; the spec tells you if you forget.

## Validate

```bash
pnpm build
TEXULI_E2E_PORT=<your port> pnpm exec playwright test tests/e2e/site-primitives-page.spec.ts
```

The spec covers:
- the data checks (once, on Chromium);
- the index and all 41 pages: the anatomy box count and nesting, the import line, and behavior checks and limits that match the scenario;
- keyboard use of the rows disclosure;
- no foreign requests;
- axe (WCAG 2.1 A/AA) on every page in light and dark, with the disclosures open, on desktop Chromium, WebKit and the Pixel 7.

## Limits

- **No live results:** the page shows what the behavior suite checks and its limits, not pass/fail results from a run, because no run results are committed.
- **Budgets, not measurements:** sizes are budgets only. Measured sizes live in `docs/quality/perf-primitives.md` and `pnpm size`.
- **Curated anatomy:** the nesting is curated. The spec proves the parts exist, not that they nest exactly as drawn; the primitive docs in `packages/primitives/docs/` remain the reference for composition.
