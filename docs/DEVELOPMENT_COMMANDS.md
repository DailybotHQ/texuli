# Development commands — Texuli

The authoritative command reference. Run everything from the repository
root. Nothing needs Docker, CI or network access once dependencies are
installed. Results and timings in [TESTING_GUIDE](TESTING_GUIDE.md) come from
real runs on the date given there.

## Setup

| Command | What it does |
| --- | --- |
| `pnpm install` | Install the workspace (pnpm 11, Node ≥ 24.20). Only the lockfile owner runs it |
| `pnpm test:e2e:install` | `playwright install chromium webkit`, once per machine |

## Root scripts (`package.json`)

Every root script, verbatim.

| Script | Runs | What it is for |
| --- | --- | --- |
| `pnpm dev` | `pnpm --filter @texuli/website dev` | The website dev server (`astro dev`, http://localhost:4321) |
| `pnpm build` | `pnpm --filter @texuli/website build` | Website: `prebuild` regenerates the examples catalog, then `astro check && astro build` (output `apps/website/dist`, plus sitemap, robots and social images) |
| `pnpm preview` | `pnpm --filter @texuli/website preview` | Serve the last build (`astro preview`) |
| `pnpm lint` | `biome check && pnpm check:trojan-source` | Lint + format check, whole workspace, then the Trojan Source scan |
| `pnpm lint:fix` | `biome check --write` | Apply safe fixes |
| `pnpm format` | `biome format --write` | Format only |
| `pnpm typecheck` | `pnpm -r --if-present typecheck` | Every package's `typecheck` (stops at the first failure; add `--no-bail` via `pnpm -r --no-bail typecheck` to see all) |
| `pnpm test` | `vitest run` | Unit and component tests: `packages/*/tests`, `apps/website/tests`, `scripts/tests` (not `apps/agent/tests`) |
| `pnpm test:watch` | `vitest` | Watch mode (runs once without a TTY) |
| `pnpm check` | `pnpm lint && pnpm typecheck && pnpm test && pnpm check:layers && pnpm check:surfaces` | The fast full gate |
| `pnpm test:e2e` | `playwright test` | Every browser check (e2e, behavior, visual, consumers) on Chromium, WebKit and Pixel 7 against the fixture app on `TEXULI_E2E_PORT` (default 4870) |
| `pnpm test:e2e:install` | `playwright install chromium webkit` | Install the browsers |
| `pnpm check:layers` | `tsx scripts/check-layers.ts` | Layer guard: down-only dependencies, no deep imports, no HTML/code sinks, no static `style=` |
| `pnpm check:surfaces` | `tsx scripts/generate-surfaces.ts --check` | Regenerate the agent surfaces (MCP server card, llms Tools section, `packages/tools/docs/ops.md` tables, `/mcp-server/` data) from the operations registry into a temp dir and fail on any diff; `pnpm exec tsx scripts/generate-surfaces.ts` rewrites them |
| `pnpm check:skill` | `tsx scripts/check-skill.ts` | Validate the `skills/texuli` agent skill: frontmatter, links, commands, CLI references, snippets, checksums |
| `pnpm size` | `tsx scripts/size.ts` | Build every export subpath alone (Svelte external) and compare gzip against `texuli.budgets.json`. 2026-10-26, after the owner's budget rows: `307 entries within budget`, exit 0 (local macOS run; history in [CI](CI.md#budget-audits)) |
| `pnpm visual` | `tsx scripts/visual.ts` | Visual regression against `tests/visual/visual.spec.ts-snapshots` (light and dark, desktop and Pixel 7) |
| `pnpm visual:update` | `tsx scripts/visual.ts --update` | Write new baselines (review the PNGs before committing) |
| `pnpm test:perf` | `TEXULI_PERF=1 vitest run tests/perf packages/blocks/tests/code.test.ts packages/blocks/tests/text.test.ts` | Wall-clock and scale limits (opt-in; never in the default suite) |
| `pnpm verify:packages` | `tsx scripts/packages.ts` | Build, pack and check the 25 packable packages as npm would publish them (publint, attw; `@texuli/examples` is never packed); publishes nothing |
| `pnpm check:docs` | `tsx scripts/check-docs.ts` | Every relative Markdown link and documented command is real (see Other tools) |
| `pnpm check:trojan-source` | `tsx scripts/check-trojan-source.ts` | Fail on literal bidi and zero-width control characters in tracked text files (part of `pnpm lint`); gate: `pnpm vitest run scripts/tests/trojan-source.test.ts` |

## Scoped variants

| Task | Command | Example |
| --- | --- | --- |
| Lint one path | `npx biome check <path>` | `npx biome check packages/core` |
| Fix one path | `npx biome check --write <path>` | `npx biome check --write apps/website` |
| Types, one package | `pnpm --filter <package> typecheck` | `pnpm --filter @texuli/primitives typecheck` |
| Types, every package, no early stop | `pnpm -r --no-bail typecheck` | |
| Tests, one package | `pnpm vitest run packages/<pkg>` | `pnpm vitest run packages/core` |
| Tests, one file | `pnpm vitest run <file>` | `pnpm vitest run packages/core/tests/roving.test.ts` |
| Tests by name | `pnpm vitest run -t "<name>"` | check the `passed` count: a filter that matches nothing exits 0 |
| One browser spec | `TEXULI_E2E_PORT=<port> pnpm exec playwright test <spec>` | `… tests/e2e/chat.spec.ts --project chromium` |
| One primitive's behavior | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior/scenarios/<primitive>.spec.ts` | `… scenarios/dialog.spec.ts` |
| One example's visuals | `TEXULI_E2E_PORT=<port> pnpm visual -g <example-id>` | `… pnpm visual -g texuli-toast` |
| Size, one package | `pnpm size --filter <dir>` | `pnpm size --filter primitives` |
| Pack, some packages | `pnpm verify:packages --filter <dirs>` | `pnpm verify:packages --filter core,tokens` |
| Website spec | `pnpm build`, then `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-<area>.spec.ts` | `… site-seo.spec.ts --project chromium` |

`TEXULI_E2E_PORT` picks the fixture app's port. Every parallel lane uses its
own port; 4870 is the default.

After `pnpm build`, run the relevant website spec with
`TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-<area>.spec.ts --project=chromium`.
PLAN_006's SEO and agent-surface audits are separate, opt-in offline checks;
their verified results and the analytics and platform-page browser specs are
listed in [TESTING_GUIDE](TESTING_GUIDE.md). Website size and performance
results for this plan: site-perf 10/10 (chromium) after T-91/T-92; `pnpm size`
failed 26 of 307 entries at T-93, and passes 307 of 307 after the owner's
budget rows (2026-10-26).

## Package scripts

| Package | Script | Runs |
| --- | --- | --- |
| `@texuli/core`, `@texuli/drag`, `@texuli/spec`, `@texuli/tokens`, `@texuli/tools`, `@texuli/astro` | `typecheck` | `tsc -p tsconfig.json` |
| Svelte packages (`primitives`, `texuli`, `charts`, `chat`, `data`, `media`, `editor`, `workflows`, `blocks`, `catalog`, `slides`, `player`, `examples`) | `typecheck` | `node ../../scripts/typecheck-svelte.mjs` (`svelte-check --fail-on-warnings`) |
| `tests/fixtures/app` (`@texuli/fixture-app`) | `dev` / `typecheck` | `vite` / `node ../../../scripts/typecheck-svelte.mjs` |
| `@texuli/website` | `dev` / `prebuild` / `build` / `preview` / `typecheck` / `check:csp` | `astro dev` / `node ../../scripts/generate-examples-catalog.mjs` / `astro check && astro build` / `astro preview` / `astro check` / `tsx tests/csp-coverage.mts` (after a build) |
| `@texuli/agent` | `typecheck` / `dev` | `tsc -p tsconfig.json` / `tsx src/node.ts` (local service on the fake replay provider). Tests: `pnpm --filter @texuli/agent exec vitest run` (its own `vitest.config.ts`; not in `pnpm test`) |
| `native/` (Gradle, not a pnpm package) | `check` | `./native/gradlew -p native check` with JDK 21 ([native/README](../native/README.md)) |

## Other tools

| Command | What it does |
| --- | --- |
| `pnpm exec tsx scripts/supply-chain.ts [--json]` | Supply-chain report and CycloneDX SBOM (`tmp/supply-chain/sbom.cdx.json`); gate: `pnpm vitest run scripts/tests/supply-chain.test.ts` |
| `pnpm exec tsx scripts/check-docs.ts` | Every relative link in tracked Markdown resolves (headings included) and every documented `pnpm`/`npx`/`tsx`/`bash` command names a real script, package, binary or path; gate: `pnpm vitest run scripts/tests/check-docs.test.ts` |
| `pnpm exec tsx scripts/check-css.ts` | No dead CSS in the package stylesheets: no repeated declaration in a rule, no rule identical to an earlier one, no declaration a later same-selector rule always overrides, and no `tx-*` class selector that no source file can produce (template-built classes count); gate: `pnpm vitest run scripts/tests/check-css.test.ts` |
| `pnpm exec tsx scripts/dist-parity.ts [--tarballs] [--json]` | Build one consumer entry (styled components, chart families, block loaders, the slides stage) twice with Vite, from the workspace sources and from the svelte-package `dist/` (or, with `--tarballs`, from `tmp/packages/tarballs/` after `pnpm verify:packages`), and fail when the dist build is over 2 % bigger (raw or gzip) or emits more files; output in `tmp/dist-parity/`; tests: `pnpm vitest run scripts/tests/dist-parity.test.ts` |
| `pnpm exec tsx scripts/check-llms-parity.ts` | Reconcile the component catalog, built Markdown twins, llms component docs and example registry; tests: `pnpm vitest run scripts/tests/check-llms-parity.test.ts`; T-24 recorded exit 0 (133 components, 157 examples, 108 directories) |
| `node scripts/audit-seo.mjs --dist apps/website/dist` | Offline SEO audit of a completed website build; tests: `pnpm vitest run scripts/tests/audit-seo.test.ts`; T-29 recorded exit 0 (550 pages, 0 critical, 33 warnings, 4 planned). Opt-in |
| `node scripts/audit-aeo.mjs --dist apps/website/dist` | Offline agent-surface audit of a completed website build; tests: `pnpm vitest run scripts/tests/audit-aeo.test.ts`; T-30 recorded exit 0 (26 top routes, 187 twins, 0 critical, 2 warnings, 3 planned). Opt-in |
| `pnpm vitest run scripts/tests/theme-sweep.test.ts` | Test the deterministic theme sweep helpers. There is no durable sweep CLI; T-77 used a temporary runner: 14/14 sample and 210/210 full cells, no red cells; it does not render components in a browser. Details: `.dwp/plans/PLAN_006_website_marketing_seo_analytics/analysis_results/themes-sweep-findings.md` (local plan evidence, git-ignored) |
| `pnpm exec tsx scripts/generate-site-llms.ts` | Regenerate the checked-in root `llms.txt`; its freshness is asserted by `scripts/tests/site-loaders.test.ts` |
| `pnpm exec tsx tests/behavior/harness/limits-cli.ts [<primitive>] [--measure]` | Report the last behavior run against its limits |
| `pnpm exec tsx scripts/check-skill.ts --write-sums` | Regenerate `skills/texuli/SHA256SUMS` after an intentional skill edit |
| `pnpm exec tsx scripts/check-skill.ts --refresh-mirror` | Refresh the dogfood mirror `.agents/skills/texuli/` and its `skills-lock.json` hash |
| `pnpm exec tsx scripts/check-skill.ts --release-plan` | Print the next skill release (`skip`, `current`, `last_tag`, `bump`, `version`, `tag` lines) from the Conventional Commits since the last `skill-v` tag; read-only. Used by the skill-release workflow |
| `pnpm exec tsx scripts/check-skill.ts --release <version> [--date <YYYY-MM-DD>] [--notes <file>]` | Stamp a skill release locally (version in every `SKILL.md`, the changelog, `SHA256SUMS`, the mirror) and validate the pack; refuses a version that differs from the plan. The skill-release workflow runs it; see [RELEASE](RELEASE.md#skill-release) |
| `pnpm exec tsx scripts/coverage-matrix.ts [--json] [--out <file>]` | The JSON coverage matrix: for every Svelte component of the published component packages, its catalog manifest, spec id and capability, player loader, render catalogs, example and docs page, plus the gaps. Offline and read-only; tests: `pnpm vitest run scripts/tests/coverage-matrix.test.ts` |
| `pnpm exec tsx packages/player/scripts/render-specs.ts [--check]` | Regenerate (or, with `--check`, fail on drift in) `packages/player/src/render-specs.ts`, the lean render specs the player's catalog is built from; `packages/player/tests/render-specs.test.ts` fails on drift |
| `pnpm exec tsx packages/spec/scripts/generate.ts [--check]` | Regenerate the spec projections, `manifest.json` and the digest stamps (or fail on drift); a moved digest needs a `versions.json` pin ([contract](../packages/spec/docs/contract.md)) |
| `pnpm exec tsx native/conformance/web/trace.ts [--write]` | Check (or refresh) the web half of the dual-target golden gate: one semantic trace per spec golden in `native/conformance/expected/` |
| `pnpm exec tsx native/conformance/web/structure.ts` | Native structure checks without a JDK: Kotlin files, generated sources consumed in place, traces target-independent, and the Kotlin contract patterns equal to the spec's |
| `./skills/texuli/setup.sh --verify [--expect-version <v>]` | Verify the skill pack checksums (pinned installs: `skills/texuli/setup/pinned-install.md`) |
| `bash .agents/skills/deepworkplan/verify/conformance.sh --repo-only` | Read-only DWP repository conformance check |
| `python3 .agents/skills/deepworkplan/shared/config.py show --repo .` | Print the addon registry (`.dwp/config.json`) |

## Non-interactive shells (agents)

- `pnpm dev` and `pnpm preview` return immediately and leave Astro's server
  running. Stop it with `pnpm --filter @texuli/website exec astro dev stop`
  (or `… astro preview stop`). Stop what you start.
- A Playwright run that is killed can leave the fixture app's Vite server
  bound to its port. Find it with `lsof -nP -iTCP:<port> -sTCP:LISTEN` and
  stop only your own process.

## Not available

There are no release, publish or deploy commands. Packages are
`private: true`; npm carries the 25 packable packages as the CI-published
`0.8.0` release (dist-tags `latest` and `next`; pre-1.0, not stable) — publishing runs
through the publish workflow (see [CI](CI.md)). See [RELEASE](RELEASE.md)
for the version and owner-GO policy. texuli.com deploys from `main`
(CI in [CI](CI.md)); pushing and adding a remote stay gated on the
developer's instructions.
