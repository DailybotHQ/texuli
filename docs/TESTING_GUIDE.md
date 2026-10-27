# Testing guide — Texuli

How to validate a change, from the cheapest scoped check to the full gate.
Every command in section 1 was **run** on 2026-10-24 in this repository
(Node 26, pnpm 11, Vitest 5, Playwright, Biome 2, TypeScript 6). The
results recorded are those runs. Browser commands need
`TEXULI_E2E_PORT=<port>`: the fixture app's port (default 4870). Parallel
lanes each use their own.

PLAN_006 verification recorded on 2026-10-26 is called out separately below,
with every number inline. The plan's per-task logs under
`.dwp/plans/PLAN_006_website_marketing_seo_analytics/analysis_results/` and
its `PROGRESS.md` are local plan evidence (git-ignored): they exist only in the
checkout that ran the plan. Size and site performance (T-91..T-93 and T-98,
2026-10-26): `pnpm size` failed 26 of 307 entries in the T-93 run and 27 in
the T-98 run (19 without a budget row, 7 over their cap, plus
`@texuli/editor/controller` 4 B over). The owner then added and raised the
rows in `texuli.budgets.json` (measured + 4% headroom, reasons in each
`note`), and a local `pnpm size` on 2026-10-26 reported `307 entries within
budget`, exit 0 (details in [CI](CI.md#budget-audits)). Site-perf passes
10/10 on chromium after T-92's header-logo diet, and `/` weighs 83.8 KB
against its 152 KB budget.

## 1. Gates

### Fast gates (no browser)

| Gate | Command | Result on 2026-10-24 (refreshed 2026-10-27 where noted) |
| --- | --- | --- |
| Lint + format | `pnpm lint` | exit 0: 2815 files checked, 23 warnings, no errors (3 s; FINAL-docs-honesty re-run) |
| Types (every package) | `pnpm typecheck` | exit 0: every package, `astro check` 0 errors (95 s) |
| Unit + component tests | `pnpm test` | 2026-10-27, after the lean-suite trim: 194 files, 1551 passed, 2 skipped, 0 failed (20 s). Was 5941 tests before the trim |
| Layer guard | `pnpm check:layers` | ✓ dependencies point down; no banned imports, sinks or static styles (3 s) |
| The fast full gate | `pnpm check` (lint, typecheck, test, layers) | 2026-10-27: exit 0 (about 1 min 20 s) |
| Docs links and commands | `pnpm exec tsx scripts/check-docs.ts` | 2026-10-27: 537 docs, every relative link and command is real (also a test in `pnpm test`) |
| Dead CSS | `pnpm exec tsx scripts/check-css.ts` | 71 package stylesheets, no dead CSS (also a test in `pnpm test`: `scripts/tests/check-css.test.ts`) |
| Agent skill | `pnpm check:skill` | `skills/texuli pack is valid` (2 s) |
| Size budgets | `pnpm size` | 251 entries: 250 within budget, `@texuli/tokens/aa-gate` over (10,817 B > 10,624 B); exit 1 (1 min 44 s, machine under load). Superseded: 2026-10-26, 307 entries within budget, exit 0 (row below) |
| Packaging (pack, publint, attw; publishes nothing) | `pnpm verify:packages` | all packages pass; tarballs and SHA256SUMS in `tmp/packages/` (2 min 2 s) |
| Perf and scale limits (opt-in) | `pnpm test:perf` | 6 files, 128 passed (36 s under load, 2026-10-25) |
| Supply chain + SBOM | `pnpm vitest run scripts/tests/supply-chain.test.ts` | 9 passed (2 s) |
| Harness conformance | `bash .agents/skills/deepworkplan/verify/conformance.sh --repo-only` | 16 of 17 pass in a lane worktree; the one miss is `.dwp/plans`, which lives only in the main checkout (`.dwp/` is git-ignored) |
| PLAN_006 SEO audit (opt-in, after build) | `node scripts/audit-seo.mjs --dist apps/website/dist` | T-29: exit 0; 550 pages, 0 critical, 33 warnings, 4 planned. Evidence (local plan evidence, git-ignored): `analysis_results/29.task_seo-audit-script.md` |
| PLAN_006 agent-surface audit (opt-in, after build) | `node scripts/audit-aeo.mjs --dist apps/website/dist` | T-30: exit 0; 26 top routes, 187 twins, 0 critical, 2 warnings, 3 planned. Evidence (local plan evidence, git-ignored): `analysis_results/30.task_aeo-verify-script.md` |
| PLAN_006 llms parity | `pnpm exec tsx scripts/check-llms-parity.ts` | T-24: exit 0; 133 component pages, 157 examples across 108 directories reconciled. Evidence (local plan evidence, git-ignored): `analysis_results/24.task_aeo-markdown-catalog.md` |
| PLAN_006 theme token sweep (static, opt-in) | `pnpm vitest run scripts/tests/theme-sweep.test.ts` | T-76 unit and lint gates passed; T-77's temporary runner reported 14/14 sample and 210/210 full cells with no red cells. It does not render components in a browser (findings: `analysis_results/themes-sweep-findings.md`, local plan evidence, git-ignored). No durable sweep CLI exists yet |
| PLAN_006 size and website performance | `pnpm size`; `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-perf.spec.ts --project=chromium` | 2026-10-26 (T-93, T-98): `pnpm size` exit 1, 26 then 27 of 307 entries fail; after the owner's budget rows the same day, `307 entries within budget`, exit 0 (see [CI](CI.md#budget-audits)). site-perf: 10 passed on chromium (T-98 run); `/` 83.8 KB against 152 KB |

### Browser gates (Playwright: Chromium, WebKit, Pixel 7)

| Gate | Command | Result on 2026-10-24 |
| --- | --- | --- |
| Smoke | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/smoke.spec.ts` | 3 passed, one per project (7 s) |
| Behavior suite, one primitive | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior/scenarios/dialog.spec.ts` | 2 passed (Chromium and WebKit: one test per primitive and project runs its 5 rows), 1 skipped (the Pixel 7 runs only phone-specific rows) (5 s, 2026-10-27) |
| Behavior suite, every primitive | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior` (add `TEXULI_PERF=1` for the open-to-focus limits; report with `pnpm exec tsx tests/behavior/harness/limits-cli.ts`) | 125 passed, 0 failed, 28 skipped by design (153 tests: one per primitive and project; 79 s on a 10-core machine, 2026-10-27, test trim) |
| Visual, one example | `TEXULI_E2E_PORT=<port> pnpm visual -g texuli-toast` | 8 capture sets, no changes (12 s) |
| Visual, everything | `TEXULI_E2E_PORT=<port> pnpm visual` (`pnpm visual:update` to rebaseline; review the PNGs) | not re-run for this guide |
| Consumer apps (Vite, Astro, SvelteKit) | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/consumers/consumers.spec.ts --project=chromium` | 7 passed: Vite, Astro and SvelteKit × plain/Tailwind install the packed tarballs, build and render (2.4 min) |
| Consumer apps against the npm registry | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/consumers/consumers-registry.spec.ts --project=chromium` | 7 passed: the six consumers install the published `0.1.0-next.1` from registry.npmjs.org, build and render (53 s; contacts the network) |
| Strict CSP and Trusted Types | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/csp.spec.ts` | 21 passed, 1 skipped (the WebKit-only canary) on chromium, every example in batches of 12 per test, in the full e2e run of 2026-10-27; WebKit and the Pixel 7 not re-run since the trim (earlier: 406 passed, 2 skipped across the three projects, FIX-dev-red re-run) |
| SSR and hydration | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/ssr.spec.ts --project=chromium` | 1 passed (21 s) |
| Website build | `pnpm build` | exit 0: `astro check` 0 errors, then the static build (142 s) |
| A website spec (after `pnpm build`) | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-seo.spec.ts --project=chromium` | 45 passed on the three projects (FIX-dev-red re-run) |
| Website budgets (after `pnpm build`) | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-perf.spec.ts --project=chromium` | 10 passed (34 s) |

PLAN_006 added and extended website browser coverage in these files:
`site-seo.spec.ts` (structured data, breadcrumbs, sitemap/robots, OG art and
verification metadata), `site-aeo.spec.ts` (llms.txt, Markdown twins,
parity-facing output and `.well-known` files), `site-ia.spec.ts`,
`site-landing.spec.ts`, `site-native.spec.ts`, `site-architecture.spec.ts`,
`site-brand.spec.ts`, `site-keyboard.spec.ts` (keyboard walk per page class:
20 passed in T-98) and `site-responsive.spec.ts` (overflow and target sizes at
phone and desktop widths: 51 passed in T-98). Analytics checks are in
`analytics.spec.ts`, `analytics-fixture.spec.ts` and `analytics-csp.spec.ts`
(per-route Trusted Types policy names; its browser half needs a fixture
build); CSP coverage is in `csp.spec.ts` and `csp-report.spec.ts`. Run the
relevant spec after `pnpm build`. The plan's `PROGRESS.md` and T-18–T-39
task logs under `.dwp/plans/PLAN_006_website_marketing_seo_analytics/` are
local plan evidence (git-ignored); the results that matter are stated here.
The analytics default-off check passed 5/5 routes with zero markup or requests;
the enabled fixture passed 3/3. T-39 recorded site-perf at 13/15 with the same
two known baseline failures; after T-91/T-92 (2026-10-26) site-perf passes 10/10
on chromium with no budget value moved after them (the four route budgets
were raised earlier in PLAN_006, commit `7996bbd7`), and the `pnpm size`
reds above were resolved by owner budget rows.
These route-specific checks are opt-in locally and are run by CI's website job
after its build, except site-perf's budget tests, which the required
`audits` job runs (see [CI](CI.md)).

`pnpm test:e2e` runs every browser check at once (e2e, behavior, visual,
consumers). It is long; prefer the scoped specs below.

### Known failures on dev

Re-run 2026-10-24 on dev at `10a44f98` (FINAL-docs-honesty), two fast gates
fail. Neither comes from a docs change:
- `scripts/tests/packages.test.ts` › sideEffects ("every package declares
  CSS-only sideEffects …"): 1 failed.
- `pnpm size`: `@texuli/tokens/aa-gate` measures 10,817 B gzip against its
  10,624 B budget.

Re-checked 2026-10-26 on `chore/plan-006-followups` (working tree with
other lanes' changes): `pnpm vitest run scripts/tests/packages.test.ts
packages/tokens/tests/library-quality.test.ts` passed 22 of 22, and
`pnpm size` reported 307 entries within budget, so neither failure above
reproduces there. Re-run 2026-10-27 on the same branch: `pnpm check` exits 0,
the behavior suite passes (125 passed, 28 skipped by design, 1.3 min),
`pnpm exec playwright test tests/e2e --project chromium --grep-invert
"performance budgets"` passes 893 (14 skipped, 9.7 min), and
`site-perf.spec.ts` passes 10 after the owner raised the button and
charts-pie page caps.
`packages/tokens/tests/library-quality.test.ts` used to read commit
`5c682dd^` from git, which is not in `main`'s history and broke CI's `check`
job; it now reads a committed fixture ([CI](CI.md#known-ci-breakage-and-its-fix)).

The failures recorded earlier on 2026-10-24 (the examples registration under
strict CSP, live combobox stages, catalog-driven counts, golden embed
detectors, preview pages in the SEO checks) were fixed in FIX-dev-red.

## 2. Source-to-test map

The convention is `packages/<pkg>/src/<area>/` → `packages/<pkg>/tests/<area>.test.ts`
(flat `tests/` folder, named after the area); `packages/primitives` and
`packages/texuli` group components into family files (`forms`, `overlays`,
…), one `describe` per component. Tests are kept lean (2026-10-26 trim):
one looping test per behavior with a per-item message instead of one test
per item, no copy-string or duplicate-layer tests. Run the area's file first,
then the package, then its consumers (the layers above it).

| Source | Unit tests | Browser and other gates |
| --- | --- | --- |
| `packages/core/src/<texel>/` | `pnpm vitest run packages/core/tests/<texel>.test.ts`, then `pnpm vitest run packages/core` | core is L0: run `pnpm check`. Overlay and roving changes also run the behavior suite |
| `packages/core/src/roving/` | `pnpm vitest run packages/core/tests/roving.test.ts packages/primitives/tests/composites.test.ts packages/texuli/tests/forms.test.ts` | `tests/behavior/scenarios/{radio-group,tabs,toggle,toolbar}.spec.ts` |
| `packages/core/src/overlay/`, `inert/`, `focus-scope/`, `dismiss/` | `pnpm vitest run packages/core/tests/overlay.test.ts packages/core/tests/inert.test.ts` | `tests/behavior` (every overlay primitive), `tests/e2e/a11y-overlays.spec.ts` |
| `packages/core/src/editor/` (the editor model, transforms, history, keymap, Markdown codec) | `pnpm vitest run packages/core/tests/editor-model.test.ts packages/core/tests/editor-transforms.test.ts packages/core/tests/editor-history.test.ts packages/core/tests/editor-markdown.test.ts` | core is L0: run `pnpm check`. The seeded random-edit and round-trip property tests are in these files |
| `packages/core/src/url-policy/` (`safeHref`, `safeImageSrc`, `safeMediaSrc`) | `pnpm vitest run packages/core` | `tests/e2e/renderer-hostile.spec.ts`, `tests/e2e/csp.spec.ts` |
| `packages/primitives/src/<name>/` | `pnpm vitest run packages/primitives -t '^<name> '` (models, forms, overlays, composites) | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior/scenarios/<name>.spec.ts`; `pnpm size --filter primitives` |
| any primitive part that renders an id | `pnpm vitest run packages/primitives/tests/consumer-ids.test.ts` | `tests/behavior/scenarios/{select,combobox}.spec.ts` |
| `packages/primitives/src/{dialog,alert-dialog,sheet}/`, `internal/backdrop.ts` | `pnpm vitest run packages/primitives/tests/models.test.ts packages/primitives/tests/overlays.test.ts packages/texuli/tests/overlays.test.ts` | `tests/behavior/scenarios/{dialog,sheet,alert-dialog}.spec.ts` |
| `packages/primitives/src/toast/`, `packages/texuli/src/components/toast/` | `pnpm vitest run packages/primitives/tests/models.test.ts packages/primitives/tests/overlays.test.ts packages/texuli/tests/overlays.test.ts packages/texuli/tests/contracts.test.ts -t toast` | `tests/e2e/toaster-viewport.spec.ts`; `pnpm visual -g texuli-toast` |
| `packages/spec/**` (schemas, catalog vocabulary, TS and Kotlin codegen, `versions.json`) | `pnpm vitest run packages/spec` (`spec.test.ts` pins the spec digest and checks Kotlin codegen and web parity) | `./native/gradlew -p native check` (JDK 21) for the Kotlin side |
| `packages/tokens/src/**` | `pnpm vitest run packages/tokens` (contrast, generator, library, contract) | `pnpm size`; `pnpm verify:packages --filter tokens`; theme pages: `tests/e2e/site-gallery-themes.spec.ts` |
| attributes of styled form components (`packages/texuli/src/internal/control-props.ts`) | `pnpm vitest run packages/texuli/tests/forms.test.ts -t control-aria` | `tests/e2e/a11y-forms.spec.ts` |
| `packages/texuli/src/components/<name>/` | `pnpm vitest run packages/texuli -t '^<name> '` (forms, overlays, display, navigation, contracts) | `pnpm visual -g <example-id>` (the examples in `packages/examples/src/<name>/`); the a11y sweeps in `tests/e2e/a11y-{forms,display,overlays}.spec.ts` |
| `packages/texuli/src/layouts/<layout>/` | `pnpm vitest run packages/texuli/tests/layouts.test.ts -t '^layouts-<layout> '` (or `-t '^layout-host'`) | `pnpm visual -g layouts-<layout>`; `tests/e2e/layouts-app.spec.ts` |
| `packages/charts/src/<family>/` and `src/math/layout/` | `pnpm vitest run packages/charts/tests/<family>.test.ts packages/charts/tests/math.test.ts` | `tests/e2e/charts.spec.ts` and `tests/e2e/charts-families.spec.ts` (tooltips, legend toggles, `visibleDomain` windows, keyboard data tables, canvas renderer, RTL) and `tests/e2e/charts-worker.spec.ts`; `tests/e2e/domain-polish.spec.ts` (charts lay out at their measured width, phone widths); consumers: `vite-plain` builds the worker entry; `pnpm visual -g charts-<family>`; perf: `tests/perf/charts-large-data.test.ts` (`pnpm test:perf`) |
| `packages/data/src/<view>/` | `pnpm vitest run packages/data/tests/<view>.test.ts` | `pnpm visual -g data-<view>`; `tests/e2e/a11y-display.spec.ts`; `tests/e2e/domain-polish.spec.ts` (calendar week view on phones, narrow grids); perf: `pnpm test:perf` |
| `packages/media/src/<area>/` | `pnpm vitest run packages/media/tests/<area>.test.ts` | `pnpm visual -g media-<area>`; `tests/e2e/a11y-display.spec.ts -g media`; `tests/e2e/domain-polish.spec.ts` (waveform spans the player, video controls) |
| `packages/editor/src/**` | `pnpm vitest run packages/editor` | `pnpm visual -g " editor-"`; `pnpm size --filter @texuli/editor` |
| `packages/chat/src/**` | `pnpm vitest run packages/chat` | `tests/e2e/chat-thread.spec.ts`, `tests/e2e/chat-composer.spec.ts` |
| `packages/blocks/src/<family>/` | `pnpm vitest run packages/blocks/tests/<family>.test.ts` | `pnpm visual -g blocks-<family>`; perf: `pnpm test:perf` (code, text) |
| `packages/slides/src/**` | `pnpm vitest run packages/slides` | `tests/e2e/a11y-slides.spec.ts`, `tests/e2e/site-slides.spec.ts` |
| `packages/player/src/**` | `pnpm vitest run packages/player` | `tests/e2e/site-builder.spec.ts` |
| `packages/astro/src/**` | `pnpm vitest run packages/astro` | `tests/e2e/astro-islands.spec.ts` and `tests/consumers/consumers.spec.ts` (the `astro-plain` consumer installs the packed `@texuli/astro`) |
| `packages/catalog/src/**` (manifests, build, render) | `pnpm vitest run packages/catalog` | `tests/e2e/renderer-hostile.spec.ts`; `tests/perf/catalog-render-limits.test.ts` (`pnpm test:perf`); the site's live-components tests |
| `packages/tools/src/**` (CLI, llms, a2ui, elements, golden, mcp) | `pnpm vitest run packages/tools` | `pnpm check:skill` when the skill references a command |
| `packages/examples/src/index.ts`, `packages/examples/package.json` `sideEffects` | `pnpm vitest run packages/examples/tests/registration-side-effects.test.ts` | `tests/e2e/csp.spec.ts` (builds the fixture app for production) |
| `packages/examples/src/**` | `pnpm vitest run packages/examples` | `TEXULI_E2E_PORT=<port> pnpm visual -g <example-id>` (commit the new baselines) |
| `skills/texuli/**`, `scripts/check-skill.ts` | `pnpm check:skill && pnpm vitest run scripts/tests/skill.test.ts` | after an intentional pack edit: `pnpm exec tsx scripts/check-skill.ts --write-sums` |
| `scripts/check-layers.ts` | `pnpm vitest run scripts/tests/layers.test.ts` | `pnpm check:layers` |
| `scripts/check-docs.ts`, `scripts/check-css.ts`, `scripts/check-trojan-source.ts` | `pnpm vitest run scripts/tests/check-docs.test.ts scripts/tests/check-css.test.ts scripts/tests/trojan-source.test.ts` | `pnpm check:docs`; `pnpm check:trojan-source` |
| `scripts/size.ts`, `texuli.budgets.json` | `pnpm vitest run scripts/tests/size.test.ts` | `pnpm size` |
| `scripts/packages.ts` | `pnpm vitest run scripts/tests/packages.test.ts` | `pnpm verify:packages` |
| `scripts/visual.ts`, `tests/visual/**` | `pnpm vitest run scripts/tests/visual.test.ts` | `pnpm visual -g <example-id>` |
| `scripts/supply-chain.ts` | `pnpm vitest run scripts/tests/supply-chain.test.ts` | — |
| `tests/consumers/**` | `pnpm vitest run scripts/tests/consumers-harness.test.ts` | `tests/consumers/consumers.spec.ts` and `tests/consumers/consumers-registry.spec.ts` |
| `apps/website/src/components/<area>/`, `pages/<area>/` | `pnpm vitest run scripts/tests/site-<area>.test.ts` where one exists, and `pnpm vitest run apps/website` | `pnpm build`, then `tests/e2e/site-<area>.spec.ts` (every area has one; design notes in `apps/website/docs/site-<area>.md`) |
| `apps/website` layout, nav, SEO (indexed pages only; previews are noindex), perf | `pnpm vitest run scripts/tests/site-loaders.test.ts apps/website/tests/docs-reading.test.ts` | `tests/e2e/site-{docs-shell,docs-nav,seo,perf}.spec.ts`; every page: `tests/e2e/a11y-site.spec.ts` |
| `apps/website` SEO metadata, sitemap, robots and OG output | `pnpm vitest run apps/website/tests/analytics-client.test.ts apps/website/tests/site-build-guards.test.ts` (verification metas, JSON-LD escaping, sitemap lastmod) | `tests/e2e/site-seo.spec.ts`; offline built-output audit: `node scripts/audit-seo.mjs --dist apps/website/dist` (T-29 exit 0; see the gate table above) |
| `apps/website` agent discovery, llms.txt and Markdown twins | `pnpm vitest run apps/website` | `tests/e2e/site-aeo.spec.ts`; `pnpm exec tsx scripts/check-llms-parity.ts`; `node scripts/audit-aeo.mjs --dist apps/website/dist` (T-30 exit 0; both audits are opt-in after build) |
| `apps/website` analytics loader, proxy and event wiring | `pnpm vitest run apps/website` | `tests/e2e/analytics.spec.ts` (default-off) and `tests/e2e/analytics-fixture.spec.ts` (enabled fixture); T-39 recorded 5/5 and 3/3 respectively. `tests/e2e/analytics-csp.spec.ts` checks the Trusted Types policy names per route. Fixture build requires `PUBLIC_UMAMI_WEBSITE_ID=fixture-analytics-id` |
| `apps/website` landing and platform pages | `pnpm vitest run apps/website` | `tests/e2e/site-landing.spec.ts`, `tests/e2e/site-native.spec.ts`, `tests/e2e/site-architecture.spec.ts`, `tests/e2e/site-ia.spec.ts`, `tests/e2e/site-brand.spec.ts`, `tests/e2e/site-keyboard.spec.ts`, `tests/e2e/site-responsive.spec.ts` |
| `functions/_middleware.ts`, `functions/api/umami/[[path]].ts`, `functions/_lib/` (Cloudflare Pages Functions) | `pnpm vitest run apps/website/tests/edge-middleware.test.ts apps/website/tests/umami-proxy.test.ts` | Type-checked through the website tests that import them (`pnpm --filter @texuli/website typecheck`); the real Pages runtime is checked only after a deploy ([CI](CI.md#website-deployment-texulicom)) |
| `apps/agent/**` (agent service) | `pnpm --filter @texuli/agent exec vitest run` (not collected by `pnpm test`) | `pnpm --filter @texuli/agent typecheck`; `tests/e2e/site-agent-chat.spec.ts`; evals: `pnpm exec tsx apps/agent/evals/run.ts` |
| `native/**` (Kotlin Multiplatform twin) | — | `./native/gradlew -p native check` (JDK 21; not in CI) |
| `apps/website` CSP headers and reports | `pnpm vitest run apps/website` | `tests/e2e/csp.spec.ts`, `tests/e2e/csp-report.spec.ts`; CSP build integration also runs `pnpm --filter @texuli/website check:csp` |
| `scripts/audit-seo.mjs`, `scripts/audit-aeo.mjs` | `pnpm vitest run scripts/tests/audit-seo.test.ts scripts/tests/audit-aeo.test.ts` | After a website build, run each offline audit against `apps/website/dist`; the PLAN_006 runs (results in the gate table above) are recorded in `analysis_results/29.task_seo-audit-script.md` and `analysis_results/30.task_aeo-verify-script.md` (local plan evidence, git-ignored) |
| `scripts/check-llms-parity.ts` | `pnpm vitest run scripts/tests/check-llms-parity.test.ts` | `pnpm exec tsx scripts/check-llms-parity.ts`; T-24 recorded exit 0 and reconciled the component docs, twins and example registry |
| `scripts/theme-sweep.ts` | `pnpm vitest run scripts/tests/theme-sweep.test.ts` | Static helper only; there is no durable CLI. T-77 used a temporary runner (14/14 sample and 210/210 full cells, no red cells); findings and the browser-measurement boundary are in `analysis_results/themes-sweep-findings.md` (local plan evidence, git-ignored) |
| `scripts/generate-site-llms.ts` | `pnpm vitest run packages/tools/tests/llms-site.test.ts` | `pnpm exec tsx scripts/generate-site-llms.ts` regenerates the checked-in root `llms.txt`; built output freshness is checked by `tests/e2e/site-aeo.spec.ts` |
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

- **Vitest collects** `packages/*/tests/**/*.test.ts`,
  `apps/website/tests/**/*.test.ts`, `scripts/tests/**/*.test.ts` and, only
  with `TEXULI_PERF=1` or an explicit path, `tests/perf/**`. A test in `src/`
  or named `*.spec.ts` outside Playwright's folders never runs. The
  `apps/website/tests` entry was added to the owner-held `vitest.config.ts` in
  commit `e6c5d205` (PLAN_006); the owner's acknowledgement of that change is
  pending. `apps/agent/tests` is **not** collected: run it with
  `pnpm --filter @texuli/agent exec vitest run` (its own config). CI runs
  neither those tests nor the native Gradle build.
- **The Pages Functions run under Vitest, not Cloudflare's runtime.** How
  Pages applies `_headers` to Function responses is only observable after a
  deploy (see the S-2 note in [SECURITY](SECURITY.md#15-website-edge-functions-and-analytics)).
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
