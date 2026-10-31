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
| Token hardcodes | `pnpm exec tsx scripts/check-token-usage.ts` | 782 package stylesheets, no literal outside the allowlist (839 kept, each with a reason; most are the deck-scope and pending-adoption entries); also a test in `pnpm test`: `scripts/tests/check-token-usage.test.ts` |
| Agent skill | `pnpm check:skill` | `skills/texuli pack is valid` (2 s) |
| Agent surfaces | `pnpm check:surfaces` | `check:surfaces ✓ 4 generated surfaces match the registry` |
| Agent evals (scripted MCP sessions, no model) | `pnpm vitest run tests/agent-evals` | 2026-10-30 (T-ds-agent-tools): 2 files, 14 passed (the three design-system jobs included: a branded dashboard, a DTCG import, a refused document repaired from its codes); also part of `pnpm test` |
| Size budgets | `pnpm size` | 251 entries: 250 within budget, `@texuli/tokens/aa-gate` over (10,817 B > 10,624 B); exit 1 (1 min 44 s, machine under load). Superseded: 2026-10-26, 307 entries within budget, exit 0 (row below) |
| Packaging (pack, publint, attw; publishes nothing) | `pnpm verify:packages` | all packages pass; tarballs and SHA256SUMS in `tmp/packages/` (2 min 2 s) |
| Perf and scale limits (opt-in) | `pnpm test:perf` | 6 files, 128 passed (36 s under load, 2026-10-25) |
| Supply chain + SBOM | `pnpm vitest run scripts/tests/supply-chain.test.ts` | 9 passed (2 s) |
| Harness conformance | `bash .agents/skills/deepworkplan/verify/conformance.sh --repo-only` | 16 of 17 pass in a lane worktree; the one miss is `.dwp/plans`, which lives only in the main checkout (`.dwp/` is git-ignored) |
| PLAN_006 SEO audit (opt-in, after build) | `node scripts/audit-seo.mjs --dist apps/website/dist` | T-29: exit 0; 550 pages, 0 critical, 33 warnings, 4 planned. Evidence (local plan evidence, git-ignored): `analysis_results/29.task_seo-audit-script.md` |
| PLAN_006 agent-surface audit (opt-in, after build) | `node scripts/audit-aeo.mjs --dist apps/website/dist` | T-30: exit 0; 26 top routes, 187 twins, 0 critical, 2 warnings, 3 planned. Evidence (local plan evidence, git-ignored): `analysis_results/30.task_aeo-verify-script.md` |
| Markdown twin parity (after build) | `pnpm exec tsx scripts/check-md-parity.ts --strict` | PLAN_011 T-ar-twins: exit 0; 649 of 650 HTML pages have a valid twin, 1 exempt (`/404.html`). CI: website shard 1 |
| Markdown twins on the built site | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-twins.spec.ts --project chromium` | PLAN_011 T-ar-twins: 4 passed on chromium (the real middleware in front of `dist`: `/index.md` and non-docs twins with their header block, Accept negotiation with `Vary`, the head link, the Markdown 404) |
| PLAN_006 llms parity | `pnpm exec tsx scripts/check-llms-parity.ts` | T-24: exit 0; 133 component pages, 157 examples across 108 directories reconciled. Evidence (local plan evidence, git-ignored): `analysis_results/24.task_aeo-markdown-catalog.md` |
| PLAN_006 theme token sweep (static, opt-in) | `pnpm vitest run scripts/tests/theme-sweep.test.ts` | T-76 unit and lint gates passed; T-77's temporary runner reported 14/14 sample and 210/210 full cells with no red cells. It does not render components in a browser (findings: `analysis_results/themes-sweep-findings.md`, local plan evidence, git-ignored). No durable sweep CLI exists yet |
| PLAN_006 size and website performance | `pnpm size`; `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-perf.spec.ts --project=chromium` | 2026-10-26 (T-93, T-98): `pnpm size` exit 1, 26 then 27 of 307 entries fail; after the owner's budget rows the same day, `307 entries within budget`, exit 0 (see [CI](CI.md#budget-audits)). site-perf: 10 passed on chromium (T-98 run); `/` 83.8 KB against 152 KB |

### Browser gates (Playwright: Chromium, WebKit, Pixel 7)

| Gate | Command | Result on 2026-10-24 |
| --- | --- | --- |
| Behavior suite, one primitive | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior/scenarios/dialog.spec.ts` | 2 passed (Chromium and WebKit: one test per primitive and project runs its 5 rows; none is phone-specific, so no Pixel 7 rows) (2026-10-27) |
| Behavior suite, every primitive | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior` (add `TEXULI_PERF=1` for the open-to-focus limits; report with `pnpm exec tsx tests/behavior/harness/limits-cli.ts`) | 91 passed, 0 failed, 0 skipped (47 Chromium, 44 WebKit: one test per primitive and project; the phone-specific rows run inside the Chromium test in a Pixel 7 context; the pure harness rules are Vitest, `scripts/tests/behavior-harness.test.ts`; 5.8 min at load average ~70 on a 10-core machine, 2026-10-27, `ci/fast-5min`). Before: 153 tests (125 passed, 28 skipped) |
| Visual, one example | `TEXULI_E2E_PORT=<port> pnpm visual -g texuli-toast` | 8 capture sets, no changes (12 s) |
| Visual, everything | `TEXULI_E2E_PORT=<port> pnpm visual` (`pnpm visual:update` to rebaseline; review the PNGs) | not re-run for this guide |
| Consumer apps (Vite, Astro, SvelteKit), every package and subpath | `pnpm verify:packages && TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/consumers/consumers.spec.ts --project chromium` (one app: `-g sveltekit-plain`; how it works: [tests/consumers/README.md](../tests/consumers/README.md)) | 2026-10-28: 7 passed (the six apps plus the matrix check) in about 2.5 min of the 3.0 min run that also held the registry spec, after `pnpm verify:packages` passed for 21 packages; each app installed all 21 tarballs offline and imported 372 subpaths (357 modules, 5 stylesheets, 1 Tailwind stylesheet, 3 Astro and 6 Node-only entries). Whole validation (`pnpm verify:packages && … playwright test tests/consumers`): 14 passed, 6 min 30 s wall |
| Consumer apps against the npm registry | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/consumers/consumers-registry.spec.ts --project=chromium` | 7 passed: the six consumers install the published `0.1.0-next.1` from registry.npmjs.org, build and render (53 s; contacts the network) |
| Strict CSP and Trusted Types | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/csp.spec.ts --project chromium` | 6 passed on chromium (2026-10-27, `ci/fast-5min`): the enforcement probes (plus the WebKit select canary when run on WebKit), the built site's islands under their page policies, and every registered example in four batches, about 30 s each. The package-source sink scan moved to `scripts/tests/layers.test.ts`, the hash and route checks to `apps/website/tests/site-build-guards.test.ts`; every built route's headers are `pnpm --filter @texuli/website check:csp`. WebKit and the Pixel 7 not re-run since the trim (earlier: 406 passed, 2 skipped across the three projects, FIX-dev-red re-run) |
| Fixture-app, a11y and security specs (everything in `tests/e2e` except `site-*.spec.ts`) | `TEXULI_E2E_PORT=<port> pnpm exec playwright test <the 18 spec files> --project chromium` (Playwright also takes a path regex that excludes `site-`) | 2026-10-27, `ci/fast-5min`, chromium: 38 passed, 1 skipped (the analytics enabled path, which needs a fixture build; it passed separately against one), 4.5 min wall while the load average rose from 25 to 87 on a 10-core machine (other lanes were running). Before the trim: 191 tests in 37 files. Each test walks several pages or examples in one page session; checks that need no browser moved to Vitest |
| Design-system conformance (T-ds-conformance) | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/ds-conformance.spec.ts --project chromium` (the fixture-app sheet `tests/fixtures/app/ds-conformance.html`; no build needed; `TEXULI_DS_THEME_SEED=<n>` rotates the library sample). The same checks for one file: `pnpm exec tsx packages/tools/src/cli/texuli.ts ds check <file> --render` | 2026-10-30, chromium: 5 passed in 42 s: acme (base and high-contrast), minimal and the fictional protoyard-theme/v1 brand, and six library themes (beacon-red, pulse-orange, hc-lime-black, hc-cyan-black, denim-suite, slate-masthead), each in light and dark: 75 agent-emittable components, axe 0, every painted contrast pair at its ratio, no literal color outside the 12 tracked known findings; plus a planted literal and a broken pair that the checks catch |
| SSR and hydration | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/ssr.spec.ts --project=chromium` | 1 passed (21 s) |
| Website build | `pnpm build` | exit 0: `astro check` 0 errors, then the static build (142 s) |
| A website spec (after `pnpm build`) | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-seo.spec.ts --project=chromium` | 2 passed (2026-10-27, `ci/fast-5min`): the offline SEO and AEO audits of the whole build plus an internal-link check, and the 404 page |
| Website specs (`site-*.spec.ts` except `site-perf`, after `pnpm build`) | `TEXULI_E2E_PORT=<port> pnpm exec playwright test <the 27 spec files> --project chromium` | 2026-10-27, `ci/fast-5min`, chromium: 35 passed in 27 files, 88 s wall with 5 local workers. Before the trim: 322 tests in 40 files. Each test walks one page session through its routes and states; static checks (content, metadata, JSON-LD, sitemap and robots helpers, discovery files, navigation data, reference-page data, skill-page parsing) moved to Vitest in `apps/website/tests/` |
| Website budgets (after `pnpm build`) | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-perf.spec.ts --project=chromium` | 10 passed (34 s) |

Website browser coverage after the 2026-10-27 trim: `site-seo.spec.ts` runs
the offline SEO and AEO audits (`scripts/audit-seo.mjs`, `scripts/audit-aeo.mjs`)
on the whole build, so every indexed page's head, JSON-LD, social image,
the sitemap, robots, llms.txt, the Markdown twins and the `.well-known` files
are checked, plus every same-origin link in the built HTML; the helpers
behind them are unit-tested in `apps/website/tests/site-build-guards.test.ts`.
`site-ia.spec.ts`, `site-landing.spec.ts`, `site-keyboard.spec.ts` (a full Tab
walk on five page classes and the tool shortcuts) and `site-responsive.spec.ts`
(overflow at 360 and 768 px on 17 page classes, the landing header
breakpoints and target sizes) hold the layout and keyboard checks; the native,
architecture, brand, agents, evidence, showcase, skill and primitives
reference pages have no spec of their own (their content and data are
Vitest, their axe and polish run in `a11y-site-<n>.spec.ts`). Analytics checks are in
`analytics.spec.ts` (per-route Trusted Types policy names and the default-off
build; its enabled-path test needs a fixture build); CSP coverage is in
`csp.spec.ts` and `csp-report.spec.ts`. Run the
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
charts-pie page caps. After the page-sweep trim (up to four pages per route
group, representative primitive demos), the full
`pnpm exec playwright test tests/e2e --project chromium` run passed 526
(14 skipped; 530 tests, budgets included) in 10.5 min on 2026-10-27, about
30 min of summed test time.
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
| `packages/date/src/**` | `pnpm vitest run packages/date` (Gregorian arithmetic, locale weeks, time zones) | Date is L0: run `pnpm check`, `pnpm size --filter @texuli/date`, `pnpm verify:packages --filter date`, and the calendar/date-picker behavior scenarios. |
| `packages/core/src/roving/` | `pnpm vitest run packages/core/tests/roving.test.ts packages/primitives/tests/composites.test.ts packages/texuli/tests/forms.test.ts` | `tests/behavior/scenarios/{radio-group,tabs,toggle,toolbar}.spec.ts` |
| `packages/core/src/overlay/`, `inert/`, `focus-scope/`, `dismiss/` | `pnpm vitest run packages/core/tests/overlay.test.ts packages/core/tests/inert.test.ts` | `tests/behavior` (every overlay primitive), `tests/e2e/a11y-overlays.spec.ts` |
| `packages/core/src/editor/` (the editor model, transforms, history, keymap, Markdown codec) | `pnpm vitest run packages/core/tests/editor-model.test.ts packages/core/tests/editor-transforms.test.ts packages/core/tests/editor-history.test.ts packages/core/tests/editor-markdown.test.ts` | core is L0: run `pnpm check`. The seeded random-edit and round-trip property tests are in these files; the linear-time codec bounds (hostile heading, fence, list and quote lines) run through `packages/editor/tests/markdown.test.ts` |
| `packages/core/src/url-policy/` (`safeHref`, `safeImageSrc`, `safeMediaSrc`) | `pnpm vitest run packages/core` | `tests/e2e/renderer-hostile.spec.ts`, `tests/e2e/csp.spec.ts` |
| `packages/primitives/src/<name>/` | `pnpm vitest run packages/primitives -t '^<name> '` (models, forms, overlays, composites) | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior/scenarios/<name>.spec.ts`; `pnpm size --filter primitives` |
| any primitive part that renders an id | `pnpm vitest run packages/primitives/tests/consumer-ids.test.ts` | `tests/behavior/scenarios/{select,combobox}.spec.ts` |
| `packages/primitives/src/{dialog,alert-dialog,sheet}/`, `internal/backdrop.ts` | `pnpm vitest run packages/primitives/tests/models.test.ts packages/primitives/tests/overlays.test.ts packages/texuli/tests/overlays.test.ts` | `tests/behavior/scenarios/{dialog,sheet,alert-dialog}.spec.ts` |
| `packages/primitives/src/toast/`, `packages/texuli/src/components/toast/` | `pnpm vitest run packages/primitives/tests/models.test.ts packages/primitives/tests/overlays.test.ts packages/texuli/tests/overlays.test.ts packages/texuli/tests/contracts.test.ts -t toast` | `tests/e2e/toaster-viewport.spec.ts`; `pnpm visual -g texuli-toast` |
| `packages/spec/**` (schemas, catalog vocabulary, TS and Kotlin codegen, `versions.json`) | `pnpm vitest run packages/spec` (`spec.test.ts` pins the spec digest, the golden list and migrations, and checks Kotlin codegen and web parity; `contract.test.ts` covers the 0.3.0 rules, the state surface and list text). After a normative change: `pnpm exec tsx packages/spec/scripts/generate.ts` and a `versions.json` pin | `pnpm exec tsx packages/spec/scripts/generate.ts --check`; `pnpm exec tsx native/conformance/web/trace.ts` (golden traces) and `native/conformance/web/structure.ts`; `./native/gradlew -p native check` (JDK 21) for the Kotlin side; `packages/player/tests/surface-parity.test.ts` (spec and player refuse the same state surface nodes) |
| `packages/spec/src/design-system/**`, `packages/spec/fixtures/design-systems/**` (the design-system contract) | `pnpm vitest run packages/spec/tests/design-system.test.ts packages/spec/tests/design-system-hostile.test.ts` (schema freshness, parity with the token registry and the defaults vocabulary, fixtures, codes and paths, hostile inputs). After a vocabulary change: `pnpm exec tsx packages/spec/scripts/design-system-schema.ts`, then the spec generator and a `versions.json` pin | `pnpm exec tsx packages/spec/scripts/design-system-schema.ts --check`; `./native/gradlew -p native check` (`DesignSystemFixtureTest` decodes the fixtures); `pnpm size --filter spec` |
| A blueprint's or document's `designSystem` (spec 0.10.0): `packages/spec/schemas/blueprint.schema.json`, `packages/catalog/src/validate/design-system.ts`, `packages/player/src/design-system*.ts`, `packages/pages/src/shared/design-system*.ts`, `packages/document/src/schema/schema.ts` | `pnpm vitest run packages/spec/tests/blueprint-design-system.test.ts packages/catalog/tests/validate-design-system.test.ts packages/player/tests/design-system.test.ts packages/pages/tests/design-system.test.ts packages/document/tests/design-system.test.ts` (contract, codes and paths, hostile inputs, resolve, compile and apply, refusals with a notice, the static import graph) | `pnpm exec tsx packages/spec/scripts/generate.ts --check`; `./native/gradlew -p native check` (`BlueprintDesignSystemTest`, the invalid-fixture parity); `pnpm size --filter player` |
| `packages/spec/fixtures/golden/**` | `pnpm vitest run packages/spec packages/player/tests/golden.test.ts packages/player/tests/lego.test.ts` (each golden validates, hashes stably and paints; lego's cross-package moves) | `pnpm exec tsx native/conformance/web/trace.ts --write`, then the native check (`GoldenConformanceTest` pins the count); `pnpm exec tsx tests/fixtures/golden/run-golden-fixtures.mts` |
| `packages/drag/src/**` (in development) | `pnpm vitest run packages/drag` (`parity.test.ts` fails when `docs/parity.md` and the tests drift; `package.test.ts`: SSR-safe, no dependencies, no sinks) | `pnpm size --filter @texuli/drag`; perf: `TEXULI_PERF=1 pnpm vitest run tests/perf/drag.test.ts`; consumers: `packages/primitives/tests/sortable.test.ts`, `pnpm vitest run packages/data packages/workflows` and `tests/behavior/scenarios/sortable.spec.ts` |
| `packages/primitives/src/sortable/` | `pnpm vitest run packages/primitives/tests/sortable.test.ts` | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior/scenarios/sortable.spec.ts` |
| `packages/workflows/src/**` (in development) | `pnpm vitest run packages/workflows` (model, layout, spec adapter, editor, viewer) | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior/scenarios/workflow-editor.spec.ts`; perf: `TEXULI_PERF=1 pnpm vitest run tests/perf/workflows.test.ts`; `pnpm size --filter @texuli/workflows`; the player's `workflow-graph` painter: `pnpm vitest run packages/player/tests/interaction.test.ts` |
| `packages/tokens/src/**` | `pnpm vitest run packages/tokens` (contrast, generator, library, contract) | `pnpm size`; `pnpm verify:packages --filter tokens`; theme pages: `tests/e2e/site-gallery-themes.spec.ts` |
| attributes of styled form components (`packages/texuli/src/internal/control-props.ts`) | `pnpm vitest run packages/texuli/tests/forms.test.ts -t control-aria` | `tests/e2e/a11y-forms.spec.ts` |
| `packages/texuli/src/components/<name>/` | `pnpm vitest run packages/texuli -t '^<name> '` (forms, overlays, display, navigation, contracts); PLAN_009 added focused files: `date-time` (date pickers' `today`, `TimeField`), `sheet-parts`, `overlay-stack`, `pagination-stable`, `menus-tone` and `tabs-icon` under `packages/texuli/tests/` | `pnpm visual -g <example-id>` (the examples in `packages/examples/src/<name>/`); the a11y sweeps in `tests/e2e/a11y-{forms,display,overlays}.spec.ts` |
| `packages/texuli/src/layouts/<layout>/` | `pnpm vitest run packages/texuli/tests/layouts.test.ts -t '^layouts-<layout> '` (or `-t '^layout-host'`); `layouts/content` also `packages/texuli/tests/layouts-content.test.ts`, the mobile parts `packages/texuli/tests/layouts-mobile-parts.test.ts` | `pnpm visual -g layouts-<layout>`; `tests/e2e/layouts-app.spec.ts` |
| `packages/charts/src/<family>/` and `src/math/layout/` | `pnpm vitest run packages/charts/tests/<family>.test.ts packages/charts/tests/math.test.ts`; the light sparkline: `pnpm vitest run packages/charts/tests/sparkline-lite.test.ts` (parity with the compact `Sparkline` and a first-screen JavaScript bound from a Vite build) | `tests/e2e/charts.spec.ts` (pointer tooltips in LTR and RTL, RTL label geometry, forced colors, a real module worker; every family at 320px: text size and keyboard data tables) |
| `packages/data/src/<view>/` | `pnpm vitest run packages/data/tests/<view>.test.ts` (`filter-builder`, `cohort`; the notification inbox in `activity/inbox` is `inbox.test.ts`) | `pnpm visual -g data-<view>`; `tests/e2e/a11y-display.spec.ts`; `tests/e2e/data.spec.ts` (grid editing and 100,000-row windowing under real scrolling, calendar pointer moves and first-frame scroll, phone layouts, board move menu); perf: `pnpm test:perf` |
| `packages/media/src/<area>/` | `pnpm vitest run packages/media/tests/<area>.test.ts` | `pnpm visual -g media-<area>`; `tests/e2e/a11y-display.spec.ts`; `tests/e2e/texuli-polish.spec.ts` (waveform spans the player, video controls) |
| `packages/editor/src/**` | `pnpm vitest run packages/editor` (`markdown.test.ts`: Markdown in and out at the untrusted tier; `docs.test.ts`: every subpath and export is documented) | `pnpm visual -g " editor-"`; `pnpm size --filter @texuli/editor` |
| `packages/chat/src/**` | `pnpm vitest run packages/chat` | `tests/e2e/chat.spec.ts` |
| `packages/blocks/src/<family>/` | `pnpm vitest run packages/blocks/tests/<family>.test.ts` (`text.test.ts` bounds 14 hostile 4,000-character Markdown shapes at 100 ms each) | `pnpm visual -g blocks-<family>`; perf: `pnpm test:perf` (code, text) |
| `packages/deck/src/**` (in development) | `pnpm vitest run packages/deck`: `model-*.test.ts` (schema kit, deck, layouts, backgrounds, style, motion, steps, loader, migration with `tests/fixtures/migrate/`), `engine.test.ts`, `engine-import-guard.test.ts` (the engine imports nothing outside the package), `markdown-*.test.ts` (parse, round trip, text twins, math, the hostile corpus), `authoring.test.ts` (builder, outlines, lint, patch, templates, the starter decks in `packages/deck/decks/`) | deck is L0: run `pnpm check`; `pnpm size --filter deck`; perf: `TEXULI_PERF=1 pnpm vitest run tests/perf/slides.test.ts` (the 200-slide Markdown parse); consumers: `pnpm vitest run packages/slides packages/tools/tests/deck.test.ts` |
| `packages/slides/src/**` | `pnpm vitest run packages/slides`: `stage*.test.ts` (input, canvas, routes, keys, transitions, i18n, chrome, overview, presenter window, model v1 content), `layouts.test.ts`, `components-registry.test.ts`, `components-coverage.test.ts` (every catalog id is a slide component or excluded with a reason), `export.test.ts` (v1) and `export-v2.test.ts`, `decks.test.ts` (model v1, grammar, templates and golden decks), `docs.test.ts` (every subpath, export, stage prop and stylesheet hook is documented), `stage-lazy.test.ts` (default renderer tables and `loadValidateBlock` load on first use, with a busy loading status until they arrive) and `bundle-graph.test.ts` (a Vite build of a `defaultRenderers={false}` host carries no default renderer module) | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/a11y-slides.spec.ts tests/e2e/slides-print.spec.ts`; after `pnpm build`, `tests/e2e/site-slides.spec.ts`; `pnpm visual -g slides-` (the `slides-layout-<id>`, `slides-backgrounds`, template, tour, fragments, media, slot-masters and presenter-screen examples); `pnpm size --filter slides`; perf: `TEXULI_PERF=1 pnpm vitest run tests/perf/slides.test.ts` |
| `packages/player/src/**` | `pnpm vitest run packages/player`: `examples-paint` (every emittable example paints), `loader-parity` (every emittable id has a painter), `interaction` (state, actions, bindings, sortable lists, workflow graphs), `spec-mirror` (constants equal `@texuli/spec`), `surface-parity`, `golden`, `lego` (the shared drag scope across lists), `render-specs` (the lean specs match the manifests) | `pnpm exec tsx packages/player/scripts/render-specs.ts --check`; `pnpm size --filter player`; `tests/e2e/site-builder.spec.ts` |
| `packages/astro/src/**` | `pnpm vitest run packages/astro` (`appearance.test.ts`: the appearance switcher model and island) | `tests/e2e/astro-islands.spec.ts` and `tests/consumers/consumers.spec.ts` (the `astro-plain` consumer installs the packed `@texuli/astro`) |
| `packages/catalog/src/**` (manifests, build, render) | `pnpm vitest run packages/catalog`: `coverage` (every component of the published packages is covered or excluded with a reason), `examples-roundtrip` (every manifest example validates against the spec and hashes stably), `validate-interaction` (bindings, `bind`, `on`, the state surface and list text without a spec check), `render-hostile-blueprints` (the 0.3.0 hostile corpus); linear time on untrusted text: `render-richtext` (rich text parsing), `render-hostile` (`looksExecutable`) and `validate-sinks-linear` (the draft sink scan's HTML-tag check) | `pnpm exec tsx scripts/coverage-matrix.ts`; `tests/e2e/renderer-hostile.spec.ts`; `tests/perf/catalog-render-limits.test.ts` (`pnpm test:perf`); the site's live-components tests |
| `packages/tools/src/**` (CLI, llms, a2ui, elements, golden, mcp) | `pnpm vitest run packages/tools` | `pnpm check:skill` when the skill references a command; `pnpm check:surfaces` when an operation, the MCP handler or the router changes (then `pnpm exec tsx scripts/generate-surfaces.ts` and review the diff) |
| `packages/tools/src/ops/**`, `packages/tools/src/mcp/**`, `functions/mcp.ts`, `functions/_lib/mcp-*.ts` (what an agent sees through the MCP) | `pnpm vitest run tests/agent-evals`: `sessions.test.ts` replays scripted sessions (discovery from cold including `block.list`, a pricing page through `blueprint.validate` whose table block is written only from `block.schema`, theming with the `theme-blueprint` prompt, a Markdown deck conversion, a dashboard branded through `create-design-system`, `ds.suggest`, `ds.validate` and `blueprint.theme`, a DTCG import with its round trip, and a refused design system repaired from its error codes) on the stateful stdio handler and on the remote Function with real `Request` objects, and requires identical results for every edge operation; `tool-descriptions.test.ts` lints every operation's summary (80–400 characters, says what it returns, no marketing words), stated limits, argument descriptions and bounds, closed input schema and examples, the inputs of any deprecated aliases (none in `0.10.0`), and the removed 0.8 names refused identically on both doors | `pnpm check:surfaces` after any summary change (then `pnpm exec tsx scripts/generate-surfaces.ts`); `pnpm vitest run packages/tools apps/website/tests/mcp-function.test.ts` |
| `scripts/agent-surfaces.ts`, `scripts/generate-surfaces.ts`, `scripts/mcp-remote-smoke.sh` | `pnpm vitest run scripts/tests/surfaces.test.ts scripts/tests/mcp-remote-smoke.test.ts apps/website/tests/site-build-guards.test.ts` | `pnpm check:surfaces` |
| `packages/tools/src/ops/design-system*.ts`, `packages/tools/src/cli/ds.ts` (the `ds.*` operations, `blueprint.theme`, `texuli ds`) | `pnpm vitest run packages/tools/tests/ds-ops.test.ts` (fixture parity, byte-identical output in any key order with the SVG and CSS snapshots, refusal codes and paths, hostile imports and preview values, the `ds.save` write policy, the `blueprint.validate` hook, `blueprint.theme`, every `texuli ds` command) and `pnpm vitest run tests/agent-evals` (stdio and remote parity) | `pnpm size --filter functions` (the remote Function's budget) and `pnpm check:surfaces` |
| `packages/tools/src/ds-check/**` (`texuli ds check`, `@texuli/tools/ds-check` and `/ds-check/host`), `tests/fixtures/app/ds-conformance.html` and `src/ds-conformance-page.ts` | `pnpm vitest run packages/tools/tests/ds-check.test.ts packages/tools/tests/router.test.ts` (every refusal code reaches exit 1 and the JSON with its path, exit 2 when it cannot run, the render findings' codes, the help snapshot) | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/ds-conformance.spec.ts --project chromium` (the example brands and a library sample in every mode; the known findings must still be found); a component change that the sheet paints runs it too |
| `packages/mcp/**` (in development; the `texuli-mcp` bin) | `pnpm vitest run packages/mcp packages/tools/tests/mcp-cli.test.ts` | `pnpm check:layers`; `pnpm verify:packages --filter tools,mcp`, then `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/consumers/mcp.spec.ts --project chromium` (spawns the packed bin over stdio) |
| `packages/examples/src/index.ts`, `packages/examples/package.json` `sideEffects` | `pnpm vitest run packages/examples/tests/registration-side-effects.test.ts` | `tests/e2e/csp.spec.ts` (builds the fixture app for production) |
| `packages/examples/src/**` | `pnpm vitest run packages/examples` | `TEXULI_E2E_PORT=<port> pnpm visual -g <example-id>` (commit the new baselines) |
| `skills/texuli/**`, `scripts/check-skill.ts` | `pnpm check:skill && pnpm vitest run scripts/tests/skill.test.ts` | after an intentional pack edit: `pnpm exec tsx scripts/check-skill.ts --write-sums` |
| `scripts/check-layers.ts` | `pnpm vitest run scripts/tests/layers.test.ts` | `pnpm check:layers` |
| `scripts/check-docs.ts`, `scripts/check-css.ts`, `scripts/check-trojan-source.ts` | `pnpm vitest run scripts/tests/check-docs.test.ts scripts/tests/check-css.test.ts scripts/tests/trojan-source.test.ts` | `pnpm check:docs`; `pnpm check:trojan-source` |
| `scripts/check-token-usage.ts` | `pnpm vitest run scripts/tests/check-token-usage.test.ts` | `pnpm exec tsx scripts/check-token-usage.ts` |
| `scripts/size.ts`, `texuli.budgets.json` | `pnpm vitest run scripts/tests/size.test.ts` | `pnpm size` |
| `scripts/packages.ts` | `pnpm vitest run scripts/tests/packages.test.ts` | `pnpm verify:packages` |
| `scripts/dist-parity.ts` (a consumer bundle from the packed `dist/` against one from source) | `pnpm vitest run scripts/tests/dist-parity.test.ts` (helpers, then two real Vite builds; up to 10 minutes) | `pnpm exec tsx scripts/dist-parity.ts` (`--tarballs` after `pnpm verify:packages`, `--json`) |
| `scripts/visual.ts`, `tests/visual/**` | `pnpm vitest run scripts/tests/visual.test.ts` | `pnpm visual -g <example-id>` |
| `scripts/supply-chain.ts` | `pnpm vitest run scripts/tests/supply-chain.test.ts` | — |
| `scripts/coverage-matrix.ts` | `pnpm vitest run scripts/tests/coverage-matrix.test.ts packages/catalog/tests/coverage.test.ts` | `pnpm exec tsx scripts/coverage-matrix.ts` |
| any `README.md` (root, packages, apps, `native/`) | `pnpm vitest run scripts/tests/readme-credit.test.ts` (every README carries the tagged "Powered by Dailybot" link) | `pnpm exec tsx scripts/check-docs.ts` |
| `.github/workflows/skill-release.yml`, the release paths of `scripts/check-skill.ts` | `pnpm vitest run scripts/tests/skill-release.test.ts` (version plan and bump, changelog stamp, version sync, archive and `SHA256SUMS`, the workflow's guarantees, shared install commands) | `pnpm exec tsx scripts/check-skill.ts --release-plan` (read-only) |
| `tests/e2e/*.spec.ts`, `tests/e2e/shards.json` | `pnpm vitest run scripts/tests/e2e-shards.test.ts` (every e2e spec is in exactly one CI shard) | the spec itself with `TEXULI_E2E_PORT=<port> pnpm exec playwright test <spec>` |
| `tests/consumers/**`, and any package's `exports`, `dependencies` or `bin` | `pnpm vitest run scripts/tests/consumers-harness.test.ts` (subpath derivation from the `exports` maps, the installed-graph walker, type-diagnostic judging, the generated files, one render check per UI package) | `pnpm verify:packages && TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/consumers/consumers.spec.ts --project chromium` (every packable package and every subpath in six apps); `tests/consumers/consumers-registry.spec.ts` against the published version (network) |
| `apps/website/src/components/<area>/`, `pages/<area>/` | `pnpm vitest run scripts/tests/site-<area>.test.ts` where one exists, and `pnpm vitest run apps/website` | `pnpm build`, then `tests/e2e/site-<area>.spec.ts` where the area has browser behavior (static pages have none: their data is Vitest and their axe runs in `tests/e2e/a11y-site-<n>.spec.ts`); design notes in `apps/website/docs/site-<area>.md` |
| `apps/website` layout, nav, SEO (indexed pages only; previews are noindex), perf | `pnpm vitest run scripts/tests/site-loaders.test.ts apps/website/tests/docs-reading.test.ts` | `tests/e2e/site-{docs-shell,docs-nav,seo,perf}.spec.ts`; every page: `tests/e2e/a11y-site-<n>.spec.ts` |
| `apps/website` SEO metadata, sitemap, robots and OG output | `pnpm vitest run apps/website/tests/analytics-client.test.ts apps/website/tests/site-build-guards.test.ts` (verification metas, JSON-LD builders and escaping, sitemap, robots and social-art helpers, sitemap lastmod) | `tests/e2e/site-seo.spec.ts` (runs `scripts/audit-seo.mjs` on the build); the same audit by hand: `node scripts/audit-seo.mjs --dist apps/website/dist` |
| `apps/website` agent discovery, llms.txt and Markdown twins | `pnpm vitest run apps/website` (the committed `.well-known` files and llms.txt sections: `site-build-guards.test.ts`) | `tests/e2e/site-seo.spec.ts` (runs `scripts/audit-aeo.mjs` on the build); `pnpm exec tsx scripts/check-llms-parity.ts`; the same audit by hand: `node scripts/audit-aeo.mjs --dist apps/website/dist` |
| `apps/website` analytics loader, proxy and event wiring | `pnpm vitest run apps/website` | `tests/e2e/analytics.spec.ts`: per-route Trusted Types policy names and the default-off build (no markup, no requests); its enabled-path test runs only against a fixture build (`PUBLIC_UMAMI_WEBSITE_ID=fixture-analytics-id`, see `apps/website/docs/site-analytics.md`) |
| `apps/website` landing and platform pages | `pnpm vitest run apps/website` | `tests/e2e/site-landing.spec.ts`, `tests/e2e/site-ia.spec.ts`, `tests/e2e/site-keyboard.spec.ts`, `tests/e2e/site-responsive.spec.ts` (the native and architecture pages' content is `apps/website/tests/section-contracts.test.ts`) |
| `functions/_middleware.ts`, `functions/mcp.ts`, `functions/api/umami/[[path]].ts`, `functions/_lib/` (Cloudflare Pages Functions) | `pnpm vitest run apps/website/tests/edge-middleware.test.ts apps/website/tests/umami-proxy.test.ts apps/website/tests/mcp-function.test.ts`, and `pnpm size --filter functions` for the MCP bundle | Type-checked by `pnpm --filter @texuli/website typecheck` (the website `tsconfig.json` includes `../../functions`); the real Pages runtime is checked only after a deploy ([CI](CI.md#website-deployment-texulicom)) |
| `apps/agent/**` (agent service) | `pnpm --filter @texuli/agent exec vitest run` (not collected by `pnpm test`) | `pnpm --filter @texuli/agent typecheck`; `tests/e2e/site-agent-chat.spec.ts`; evals: `pnpm exec tsx apps/agent/evals/run.ts` |
| `native/**` (Kotlin Multiplatform twin) | — | `./native/gradlew -p native check` (JDK 21; not in CI) |
| `apps/website` CSP headers and reports | `pnpm vitest run apps/website` | `tests/e2e/csp.spec.ts`, `tests/e2e/csp-report.spec.ts`; CSP build integration also runs `pnpm --filter @texuli/website check:csp` |
| `scripts/audit-seo.mjs`, `scripts/audit-aeo.mjs` | `pnpm vitest run scripts/tests/audit-seo.test.ts scripts/tests/audit-aeo.test.ts` | After a website build, run each offline audit against `apps/website/dist`; the PLAN_006 runs (results in the gate table above) are recorded in `analysis_results/29.task_seo-audit-script.md` and `analysis_results/30.task_aeo-verify-script.md` (local plan evidence, git-ignored) |
| `scripts/check-md-parity.ts` | `pnpm vitest run scripts/tests/check-md-parity.test.ts` | After a website build, `pnpm exec tsx scripts/check-md-parity.ts --strict` |
| `apps/website` Markdown twins (`src/components/docs/twins.ts`, `twin-notes.ts`, `integration.ts`, `markdown.ts`), negotiation (`src/lib/md-negotiate.ts`) and `functions/_middleware.ts` | `pnpm vitest run apps/website/tests/twins.test.ts apps/website/tests/edge-middleware.test.ts` | `pnpm build`, then `pnpm exec tsx scripts/check-md-parity.ts --strict` and `tests/e2e/site-twins.spec.ts` |
| `scripts/check-llms-parity.ts` | `pnpm vitest run scripts/tests/check-llms-parity.test.ts` | `pnpm exec tsx scripts/check-llms-parity.ts`; T-24 recorded exit 0 and reconciled the component docs, twins and example registry |
| `scripts/theme-sweep.ts` | `pnpm vitest run scripts/tests/theme-sweep.test.ts` | Static helper only; there is no durable CLI. T-77 used a temporary runner (14/14 sample and 210/210 full cells, no red cells); findings and the browser-measurement boundary are in `analysis_results/themes-sweep-findings.md` (local plan evidence, git-ignored) |
| `scripts/generate-site-llms.ts` | `pnpm vitest run packages/tools/tests/llms-site.test.ts` | `pnpm exec tsx scripts/generate-site-llms.ts` regenerates the checked-in root `llms.txt`; its freshness is checked by `scripts/tests/site-loaders.test.ts` and the built copy by the AEO audit in `tests/e2e/site-seo.spec.ts` |
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
  `apps/website/tests/**/*.test.ts`, `scripts/tests/**/*.test.ts`,
  `tests/agent-evals/**/*.test.ts` and, only
  with `TEXULI_PERF=1` or an explicit path, `tests/perf/**`. A test in `src/`
  or named `*.spec.ts` outside Playwright's folders never runs. The
  `apps/website/tests` entry was added to the owner-held `vitest.config.ts` in
  commit `e6c5d205` (PLAN_006), and the `tests/agent-evals` entry by
  T-agent-evals (PLAN_011); the owner's acknowledgement of both is pending.
  No package typecheck covers the root `tests/` folders, so
  `pnpm typecheck` does not check `tests/agent-evals` (Vitest strips types
  without checking them). `apps/agent/tests` is **not** collected: run it with
  `pnpm --filter @texuli/agent exec vitest run` (its own config). CI runs
  neither those tests nor the native Gradle build.
- **The agent evals are scripted, not a model.** `tests/agent-evals`
  proves that the calls an agent needs exist, answer the same on both
  doors and validate; it does not prove that a model picks those calls,
  reads the descriptions well or recovers from diagnostics on its own. The
  remote door runs in-process (the deployed `/mcp` is checked only by the
  post-deploy smoke), the stdio door is the handler without the line
  transport (the packed bin is `tests/consumers/mcp.spec.ts`), and the
  design-system jobs are skipped until T-ds-agent-tools.
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
  `TEXULI_PERF=1` (`tests/perf/`: builder, catalog render limits, charts,
  data grid and media, PLAN_004 surfaces, from PLAN_007, `drag.test.ts`
  and `workflows.test.ts`, and from PLAN_008 `slides.test.ts`; set
  `TEXULI_PERF_REPORT=1` to print the measured times).
- **The workflow and player drag paths in happy-dom** have no layout: the
  editor's pointer drags and the shared drag scope are tested through the
  keyboard model and the engine there, and in a browser by
  `tests/behavior/scenarios/{sortable,workflow-editor}.spec.ts`.
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
| Primitives behave | `tests/behavior` passes (Chromium and WebKit, phone rows in a Pixel 7 context) |
| Looks right | `pnpm visual` reports no changes |
| Fits its budget | `pnpm size` reports every entry within budget |
| Ships cleanly | `pnpm verify:packages` passes |
| The website builds and holds | `pnpm build`, then the `tests/e2e/site-*.spec.ts` for the area |
| The harness conforms | the conformance script prints `CONFORMANT` |
