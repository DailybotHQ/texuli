# Testing guide — Texuli

How to validate a change, from the cheapest scoped check to the full gate.
Every command in section 1 was **run** on 2026-10-24 in this repository
(Node 26, pnpm 11, Vitest 5, Playwright, Biome 2, TypeScript 6). The
results recorded are those runs. Browser commands need
`TEXULI_E2E_PORT=<port>`: the fixture app's port (default 4870). Parallel
lanes each use their own.

## 1. Gates

### Fast gates (no browser)

| Gate | Command | Result on 2026-10-24 |
| --- | --- | --- |
| Lint + format | `pnpm lint` | exit 0: 2815 files checked, 23 warnings, no errors (3 s; FINAL-docs-honesty re-run) |
| Types (every package) | `pnpm typecheck` | exit 0: every package, `astro check` 0 errors (95 s) |
| Unit + component tests | `pnpm test` | 259 files: 2881 passed, 1 failed (see known failures), 10 skipped (FINAL-docs-honesty re-run) |
| Layer guard | `pnpm check:layers` | ✓ dependencies point down; no banned imports, sinks or static styles (3 s) |
| The fast full gate | `pnpm check` (lint, typecheck, test, layers) | the four rows above; exit 1 while the known failure stands (3 min 34 s) |
| Docs links and commands | `pnpm exec tsx scripts/check-docs.ts` | 437 docs, every relative link and command is real (also a test in `pnpm test`) |
| Dead CSS | `pnpm exec tsx scripts/check-css.ts` | 71 package stylesheets, no dead CSS (also a test in `pnpm test`: `scripts/tests/check-css.test.ts`) |
| Agent skill | `pnpm check:skill` | `skills/texuli pack is valid` (2 s) |
| Size budgets | `pnpm size` | 251 entries: 250 within budget, `@texuli/tokens/aa-gate` over (10,817 B > 10,624 B); exit 1 (1 min 44 s, machine under load) |
| Packaging (pack, publint, attw; publishes nothing) | `pnpm verify:packages` | all packages pass; tarballs and SHA256SUMS in `tmp/packages/` (2 min 2 s) |
| Perf and scale limits (opt-in) | `pnpm test:perf` | 6 files, 128 passed (36 s under load, 2026-10-25) |
| Supply chain + SBOM | `pnpm vitest run scripts/tests/supply-chain.test.ts` | 9 passed (2 s) |
| Harness conformance | `bash .agents/skills/deepworkplan/verify/conformance.sh --repo-only` | 16 of 17 pass in a lane worktree; the one miss is `.dwp/plans`, which lives only in the main checkout (`.dwp/` is git-ignored) |

### Browser gates (Playwright: Chromium, WebKit, Pixel 7)

| Gate | Command | Result on 2026-10-24 |
| --- | --- | --- |
| Smoke | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/smoke.spec.ts` | 3 passed, one per project (7 s) |
| Behavior suite, one primitive | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior/scenarios/dialog.spec.ts` | 42 passed on the three projects (24 s) |
| Behavior suite, every primitive | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior` (add `TEXULI_PERF=1` for the open-to-focus limits; report with `pnpm exec tsx tests/behavior/harness/limits-cli.ts`) | 892 passed, 0 failed, 26 skipped by design (FIX-dialog-contained-focus run, 2026-10-24) |
| Visual, one example | `TEXULI_E2E_PORT=<port> pnpm visual -g texuli-toast` | 8 capture sets, no changes (12 s) |
| Visual, everything | `TEXULI_E2E_PORT=<port> pnpm visual` (`pnpm visual:update` to rebaseline; review the PNGs) | not re-run for this guide |
| Consumer apps (Vite, Astro, SvelteKit) | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/consumers/consumers.spec.ts --project=chromium` | 7 passed: Vite, Astro and SvelteKit × plain/Tailwind install the packed tarballs, build and render (2.4 min) |
| Strict CSP and Trusted Types | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/csp.spec.ts` | 406 passed, 0 failed, 2 skipped across the three projects (FIX-dev-red re-run) |
| SSR and hydration | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/ssr.spec.ts --project=chromium` | 1 passed (21 s) |
| Website build | `pnpm build` | exit 0: `astro check` 0 errors, then the static build (142 s) |
| A website spec (after `pnpm build`) | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-seo.spec.ts --project=chromium` | 45 passed on the three projects (FIX-dev-red re-run) |
| Website budgets (after `pnpm build`) | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-perf.spec.ts --project=chromium` | 10 passed (34 s) |

`pnpm test:e2e` runs every browser check at once (e2e, behavior, visual,
consumers). It is long; prefer the scoped specs below.

### Known failures on dev

Re-run 2026-10-24 on dev at `10a44f98` (FINAL-docs-honesty), two fast gates
fail. Neither comes from a docs change:
- `scripts/tests/packages.test.ts` › sideEffects ("every package declares
  CSS-only sideEffects …"): 1 failed.
- `pnpm size`: `@texuli/tokens/aa-gate` measures 10,817 B gzip against its
  10,624 B budget.

The failures recorded earlier on 2026-10-24 (the examples registration under
strict CSP, live combobox stages, catalog-driven counts, golden embed
detectors, preview pages in the SEO checks) were fixed in FIX-dev-red.

## 2. Source-to-test map

The convention is `packages/<pkg>/src/<area>/` → `packages/<pkg>/tests/<area>.test.ts`
(flat `tests/` folder, named after the area). Run the area's file first,
then the package, then its consumers (the layers above it).

| Source | Unit tests | Browser and other gates |
| --- | --- | --- |
| `packages/core/src/<texel>/` | `pnpm vitest run packages/core/tests/<texel>.test.ts`, then `pnpm vitest run packages/core` | core is L0: run `pnpm check`. Overlay and roving changes also run the behavior suite |
| `packages/core/src/roving/` | `pnpm vitest run packages/core/tests/roving.test.ts packages/primitives/tests/roving-selected.test.ts packages/texuli/tests/rating.test.ts` | `tests/behavior/scenarios/{radio-group,tabs,toggle,toolbar}.spec.ts` |
| `packages/core/src/overlay/`, `inert/`, `focus-scope/`, `dismiss/` | `pnpm vitest run packages/core/tests/overlay.test.ts packages/core/tests/inert.test.ts` | `tests/behavior` (every overlay primitive), `tests/e2e/a11y-overlays.spec.ts` |
| `packages/core/src/editor/` (the editor model, transforms, history, keymap, Markdown codec) | `pnpm vitest run packages/core/tests/editor-model.test.ts packages/core/tests/editor-transforms.test.ts packages/core/tests/editor-history.test.ts packages/core/tests/editor-markdown.test.ts` | core is L0: run `pnpm check`. The seeded random-edit and round-trip property tests are in these files |
| `packages/core/src/url-policy/` (`safeHref`, `safeImageSrc`, `safeMediaSrc`) | `pnpm vitest run packages/core` | `tests/e2e/renderer-hostile.spec.ts`, `tests/e2e/csp.spec.ts` |
| `packages/primitives/src/<name>/` | `pnpm vitest run packages/primitives/tests/<name>.test.ts` | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior/scenarios/<name>.spec.ts`; `pnpm size --filter primitives` |
| any primitive part that renders an id | `pnpm vitest run packages/primitives/tests/consumer-ids*.test.ts` | `tests/behavior/scenarios/{select,combobox}.spec.ts` |
| `packages/primitives/src/{dialog,alert-dialog,sheet}/`, `internal/backdrop.ts` | `pnpm vitest run packages/primitives/tests/dialog-contained-focus.test.ts packages/primitives/tests/dialog.test.ts packages/primitives/tests/sheet.test.ts packages/texuli/tests/sheet.test.ts` | `tests/behavior/scenarios/{dialog,sheet,alert-dialog}.spec.ts` |
| `packages/primitives/src/toast/`, `packages/texuli/src/components/toast/` | `pnpm vitest run packages/primitives/tests/toast.test.ts packages/texuli/tests/toast.test.ts` | `tests/e2e/toaster-viewport.spec.ts`; `pnpm visual -g texuli-toast` |
| `packages/tokens/src/**` | `pnpm vitest run packages/tokens` (contrast, generator, library, contract) | `pnpm size`; `pnpm verify:packages --filter tokens`; theme pages: `tests/e2e/site-gallery-themes.spec.ts` |
| attributes of styled form components (`packages/texuli/src/internal/control-props.ts`) | `pnpm vitest run packages/texuli/tests/control-aria.test.ts` | `tests/e2e/a11y-forms.spec.ts` |
| `packages/texuli/src/components/<name>/` | `pnpm vitest run packages/texuli/tests/<name>.test.ts` | `pnpm visual -g <example-id>` (the examples in `packages/examples/src/<name>/`); the a11y sweeps in `tests/e2e/a11y-{forms,display,overlays}.spec.ts` |
| `packages/texuli/src/layouts/<layout>/` | `pnpm vitest run packages/texuli/tests/layouts-<layout>.test.ts` (or `layout-host.test.ts`) | `pnpm visual -g layouts-<layout>`; `tests/e2e/layouts-app.spec.ts` |
| `packages/charts/src/<family>/` and `src/math/layout/` | `pnpm vitest run packages/charts/tests/<family>.test.ts packages/charts/tests/fit-width.test.ts` | `tests/e2e/charts.spec.ts` and `tests/e2e/charts-families.spec.ts` (tooltips, legend toggles, `visibleDomain` windows, keyboard data tables, canvas renderer, RTL) and `tests/e2e/charts-worker.spec.ts`; `tests/e2e/domain-polish.spec.ts` (charts lay out at their measured width, phone widths); consumers: `vite-plain` builds the worker entry; `pnpm visual -g charts-<family>`; perf: `tests/perf/charts-large-data.test.ts` (`pnpm test:perf`) |
| `packages/data/src/<view>/` | `pnpm vitest run packages/data/tests/<view>.test.ts` | `pnpm visual -g data-<view>`; `tests/e2e/a11y-display.spec.ts`; `tests/e2e/domain-polish.spec.ts` (calendar week view on phones, narrow grids); perf: `pnpm test:perf` |
| `packages/media/src/<area>/` | `pnpm vitest run packages/media/tests/<area>.test.ts` | `pnpm visual -g media-<area>`; `tests/e2e/a11y-display.spec.ts -g media`; `tests/e2e/domain-polish.spec.ts` (waveform spans the player, video controls) |
| `packages/editor/src/**` | `pnpm vitest run packages/editor` | `pnpm visual -g " editor-"`; `pnpm size --filter @texuli/editor` |
| `packages/chat/src/**` | `pnpm vitest run packages/chat` | `tests/e2e/chat-thread.spec.ts`, `tests/e2e/chat-composer.spec.ts` |
| `packages/blocks/src/<family>/` | `pnpm vitest run packages/blocks/tests/<family>.test.ts` | `pnpm visual -g blocks-<family>`; perf: `pnpm test:perf` (code, text) |
| `packages/catalog/src/**` (manifests, build, render) | `pnpm vitest run packages/catalog` | `tests/e2e/renderer-hostile.spec.ts`; `tests/perf/catalog-render-limits.test.ts` (`pnpm test:perf`); the site's live-components tests |
| `packages/tools/src/**` (CLI, llms, a2ui, elements, golden, mcp) | `pnpm vitest run packages/tools` | `pnpm check:skill` when the skill references a command |
| `packages/examples/src/index.ts`, `packages/examples/package.json` `sideEffects` | `pnpm vitest run packages/examples/tests/registration-side-effects.test.ts` | `tests/e2e/csp.spec.ts` (builds the fixture app for production) |
| `packages/examples/src/**` | `pnpm vitest run packages/examples` | `TEXULI_E2E_PORT=<port> pnpm visual -g <example-id>` (commit the new baselines) |
| `skills/texuli/**`, `scripts/check-skill.ts` | `pnpm check:skill && pnpm vitest run scripts/tests/skill.test.ts` | after an intentional pack edit: `pnpm exec tsx scripts/check-skill.ts --write-sums` |
| `scripts/check-layers.ts` | `pnpm vitest run scripts/tests/layers.test.ts` | `pnpm check:layers` |
| `scripts/size.ts`, `texuli.budgets.json` | `pnpm vitest run scripts/tests/size.test.ts` | `pnpm size` |
| `scripts/packages.ts` | `pnpm vitest run scripts/tests/packages.test.ts` | `pnpm verify:packages` |
| `scripts/visual.ts`, `tests/visual/**` | `pnpm vitest run scripts/tests/visual.test.ts` | `pnpm visual -g <example-id>` |
| `scripts/supply-chain.ts` | `pnpm vitest run scripts/tests/supply-chain.test.ts` | — |
| `tests/consumers/**` | `pnpm vitest run scripts/tests/consumers-harness.test.ts` | `tests/consumers/consumers.spec.ts` |
| `apps/website/src/components/<area>/`, `pages/<area>/` | `pnpm vitest run scripts/tests/site-<area>.test.ts` where one exists | `pnpm build`, then `tests/e2e/site-<area>.spec.ts` (every area has one; design notes in `apps/website/docs/site-<area>.md`) |
| `apps/website` layout, nav, SEO (indexed pages only; previews are noindex), perf | `pnpm vitest run scripts/tests/docs-shell-nav.test.ts scripts/tests/guides-nav.test.ts` | `tests/e2e/site-{docs-shell,docs-nav,seo,perf}.spec.ts`; every page: `tests/e2e/a11y-site.spec.ts` |
| root config (`package.json`, `tsconfig.base.json`, `biome.json`, `vitest.config.ts`, `playwright.config.ts`) | `pnpm check` | `pnpm build` and the smoke spec |

### Finding consumers

There is no affected-tests tool. Layers point down, so a change in layer *n*
can affect every layer above it. Find importers with:

```bash
grep -rln "@texuli/primitives/dialog" packages apps tests --include='*.ts' --include='*.svelte' --exclude-dir=node_modules
```

When you can't tell who consumes a change, run `pnpm check`, the behavior
suite and `pnpm build`.

## 3. Blind spots

- **Vitest collects** `packages/*/tests/**/*.test.ts`, `scripts/tests/**/*.test.ts`
  and, only with `TEXULI_PERF=1` or an explicit path, `tests/perf/**`. A test
  in `src/` or named `*.spec.ts` outside Playwright's folders never runs.
- **happy-dom is not a browser:**
  - there's no layout, no top layer and no real focus movement on DOM moves;
  - focus order, top-layer stacking, hit testing and blur-on-move need a
    behavior row or an e2e spec.
- **WebKit's Tab order** depends on a macOS setting: keyboard walks that Tab
  through buttons are skipped or done by focusing directly there.
- **Firefox is not covered** (Playwright's Firefox doesn't launch on this
  macOS).
- **Wall-clock assertions** live only in `pnpm test:perf` or behind
  `TEXULI_PERF=1`.
- **Automated accessibility only:**
  - axe with zero exclusions in light, dark and forced colors;
  - keyboard walks;
  - screen-reader transcripts are manual (`docs/quality/sr-transcripts.md`).
- **Visual baselines** are per platform (`*-darwin.png`); after
  `git merge dev`, rebaseline only your own examples.

## 4. Testing posture

- **Behavior at the public boundary.** Unit tests import the package's
  public entry. Browser checks assert roles, names, states, focus and events,
  never DOM shape.
- **Security gets hostile inputs:** every guard (URL policy, renderer,
  untrusted blocks) has a test per bypass class.
- **A fix ships with a test that fails without it.** Mutation-check by
  reverting the source and confirming the test fails.
- **Deterministic:** no randomness or wall-clock time outside
  `test:perf`, and fictional data only (`example.com`).
- **No exclusions to pass a gate.** No axe rule is disabled, no `force: true`
  clicks, and no budget is raised without a recorded reason.

## 5. Outcome checks

| Outcome | Observable check |
| --- | --- |
| Code is clean | `pnpm lint` and `pnpm typecheck` exit 0 |
| Behavior holds | `pnpm test` (or a scoped `pnpm vitest run <path>`) passes with a non-empty selection |
| Layers hold | `pnpm check:layers` prints the ✓ line |
| Primitives behave | `tests/behavior` passes on all three projects |
| Looks right | `pnpm visual` reports no changes |
| Fits its budget | `pnpm size` reports every entry within budget |
| Ships cleanly | `pnpm verify:packages` passes |
| The website builds and holds | `pnpm build`, then the `tests/e2e/site-*.spec.ts` for the area |
| The harness conforms | the conformance script prints `CONFORMANT` |
