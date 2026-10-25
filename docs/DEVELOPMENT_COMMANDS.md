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
| `pnpm lint` | `biome check` | Lint + format check, whole workspace |
| `pnpm lint:fix` | `biome check --write` | Apply safe fixes |
| `pnpm format` | `biome format --write` | Format only |
| `pnpm typecheck` | `pnpm -r --if-present typecheck` | Every package's `typecheck` (stops at the first failure; add `--no-bail` via `pnpm -r --no-bail typecheck` to see all) |
| `pnpm test` | `vitest run` | Unit and component tests: `packages/*/tests`, `scripts/tests` |
| `pnpm test:watch` | `vitest` | Watch mode (runs once without a TTY) |
| `pnpm check` | `pnpm lint && pnpm typecheck && pnpm test && pnpm check:layers` | The fast full gate |
| `pnpm test:e2e` | `playwright test` | Every browser check (e2e, behavior, visual, consumers) on Chromium, WebKit and Pixel 7 against the fixture app on `TEXULI_E2E_PORT` (default 4870) |
| `pnpm test:e2e:install` | `playwright install chromium webkit` | Install the browsers |
| `pnpm check:layers` | `tsx scripts/check-layers.ts` | Layer guard: down-only dependencies, no deep imports, no HTML/code sinks, no static `style=` |
| `pnpm check:skill` | `tsx scripts/check-skill.ts` | Validate the `skills/texuli` agent skill: frontmatter, links, commands, CLI references, snippets, checksums |
| `pnpm size` | `tsx scripts/size.ts` | Build every export subpath alone (Svelte external) and compare gzip against `texuli.budgets.json` |
| `pnpm visual` | `tsx scripts/visual.ts` | Visual regression against `tests/visual/visual.spec.ts-snapshots` (light and dark, desktop and Pixel 7) |
| `pnpm visual:update` | `tsx scripts/visual.ts --update` | Write new baselines (review the PNGs before committing) |
| `pnpm test:perf` | `TEXULI_PERF=1 vitest run tests/perf packages/blocks/tests/code.test.ts packages/blocks/tests/text.test.ts` | Wall-clock and scale limits (opt-in; never in the default suite) |
| `pnpm verify:packages` | `tsx scripts/packages.ts` | Build, pack and check every library package as npm would publish it (publint, attw); publishes nothing |

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
| One browser spec | `TEXULI_E2E_PORT=<port> pnpm exec playwright test <spec>` | `… tests/e2e/smoke.spec.ts --project chromium` |
| One primitive's behavior | `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior/scenarios/<primitive>.spec.ts` | `… scenarios/dialog.spec.ts` |
| One example's visuals | `TEXULI_E2E_PORT=<port> pnpm visual -g <example-id>` | `… pnpm visual -g texuli-toast` |
| Size, one package | `pnpm size --filter <dir>` | `pnpm size --filter primitives` |
| Pack, some packages | `pnpm verify:packages --filter <dirs>` | `pnpm verify:packages --filter core,tokens` |
| Website spec | `pnpm build`, then `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/e2e/site-<area>.spec.ts` | `… site-seo.spec.ts --project chromium` |

`TEXULI_E2E_PORT` picks the fixture app's port. Every parallel lane uses its
own port; 4870 is the default.

## Package scripts

| Package | Script | Runs |
| --- | --- | --- |
| `@texuli/core`, `@texuli/tokens`, `@texuli/tools` | `typecheck` | `tsc -p tsconfig.json` |
| Svelte packages (`primitives`, `texuli`, `charts`, `chat`, `data`, `media`, `blocks`, `catalog`, `examples`) | `typecheck` | `node ../../scripts/typecheck-svelte.mjs` (`svelte-check --fail-on-warnings`) |
| `tests/fixtures/app` | `dev` / `typecheck` | `vite` / `svelte-check` |
| `@texuli/website` | `dev` / `prebuild` / `build` / `preview` / `typecheck` | `astro dev` / `node ../../scripts/generate-examples-catalog.mjs` / `astro check && astro build` / `astro preview` / `astro check` |

## Other tools

| Command | What it does |
| --- | --- |
| `pnpm exec tsx scripts/supply-chain.ts [--json]` | Supply-chain report and CycloneDX SBOM (`tmp/supply-chain/sbom.cdx.json`); gate: `pnpm vitest run scripts/tests/supply-chain.test.ts` |
| `pnpm exec tsx scripts/check-docs.ts` | Every relative link in tracked Markdown resolves (headings included) and every documented `pnpm`/`npx`/`tsx`/`bash` command names a real script, package, binary or path; gate: `pnpm vitest run scripts/tests/check-docs.test.ts` |
| `pnpm exec tsx scripts/check-css.ts` | No dead CSS in the package stylesheets: no repeated declaration in a rule, no rule identical to an earlier one, no declaration a later same-selector rule always overrides, and no `tx-*` class selector that no source file can produce (template-built classes count); gate: `pnpm vitest run scripts/tests/check-css.test.ts` |
| `pnpm exec tsx tests/behavior/harness/limits-cli.ts [<primitive>] [--measure]` | Report the last behavior run against its limits |
| `pnpm exec tsx scripts/check-skill.ts --write-sums` | Regenerate `skills/texuli/SHA256SUMS` after an intentional skill edit |
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
`private: true`; npm carries all 15 packages as `0.1.0-next.1` (dist-tag
`next`) as CI-published previews, not supported releases — publishing runs
through the publish workflow (see [CI](CI.md)). See [RELEASE](RELEASE.md)
for the version and owner-GO policy. texuli.com deploys from `main`
(CI in [CI](CI.md)); pushing and adding a remote stay gated on the
developer's instructions.
