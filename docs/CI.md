# CI — GitHub Actions and deployment

The repository runs two GitHub Actions workflows. Checks run on every push
to `main` and every pull request; publishing runs on demand or on a `v*`
tag. The website deploys separately through Cloudflare Pages' own Git
integration.

## Workflows

| Workflow | File | Trigger | Jobs |
| --- | --- | --- | --- |
| CI | [.github/workflows/ci.yml](../.github/workflows/ci.yml) | push to `main`, pull requests | `check`, `behavior`, `website`, `audits` |
| Publish packages | [.github/workflows/publish.yml](../.github/workflows/publish.yml) | `v*` tag push, manual dispatch | `publish` |

- **`check`** — `pnpm check` (Biome lint, typecheck, unit and component
  tests, layer guard) plus `scripts/supply-chain.ts`, `scripts/check-docs.ts`
  and `pnpm check:skill`.
- **`behavior`** — the primitives behavior suite on chromium and webkit
  (the phone-specific rows run in a Pixel 7 context inside the chromium
  test, see
  [tests/behavior/README.md](../tests/behavior/README.md)): `TEXULI_E2E_PORT=4870 pnpm exec playwright
  test tests/behavior`. Failed runs upload `test-results/` as an artifact.
- **`website`** — `pnpm build` (which runs `astro check`, the examples
  catalog prebuild, sitemap/robots/social images and the CSP integration),
  `pnpm --filter @texuli/website check:csp`, then the browser e2e suite on
  chromium with the site-perf budget tests excluded (the audit job owns
  them). The job is a six-way matrix: each runner builds the site and runs
  one shard of the same suite. `tests/e2e/shards.json` deals the spec files
  by measured CI time (about 35 minutes of summed test time, about 1.5
  minutes per shard on four workers); `scripts/tests/e2e-shards.test.ts`
  fails when a spec is in no shard or in two, so a new spec must be added
  to a shard. The a11y page sweep is three files (`a11y-site-1..3.spec.ts`)
  so it spreads over shards. `check:csp` runs on shard 1. Locally,
  `pnpm exec playwright test tests/e2e` runs every spec.
- **Runners and browsers:** every job runs on `ubuntu-24.04` with a
  `timeout-minutes` limit. `behavior`, `website` and `audits` run in
  Playwright's image (`mcr.microsoft.com/playwright:v1.64.1-noble`, the
  pinned `@playwright/test` version), which ships the browsers and their
  system libraries, so no job installs them through apt; that step stalled
  jobs for 10 to 22 minutes on the hosted runners. Bump the image tag
  together with `@playwright/test`.
- **`audits`** — `pnpm size`, then `pnpm build` and the full
  `tests/e2e/site-perf.spec.ts`. It is a required job (no
  `continue-on-error`): a failure is a regression. Shrink the code; a
  budget is raised only as an owner decision with a reason in
  `texuli.budgets.json`. The build and site-perf steps run with
  `if: success() || failure()`, so site-perf is measured even when
  `pnpm size` is red.
- `check` and `website` check out the full history (`fetch-depth: 0`):
  `check` for the tests that read git history
  (`apps/website/tests/site-build-guards.test.ts` reads page commit dates),
  `website` because the sitemap's `lastmod` comes from each page's git
  log.
- No CI job runs the agent service tests
  (`pnpm --filter @texuli/agent exec vitest run`; the root
  `vitest.config.ts` does not collect `apps/agent/tests`) or the native
  Gradle build (`./native/gradlew -p native check`, JDK 21). Both are
  local gates.

The PLAN_006 offline site audits (`node scripts/audit-seo.mjs --dist
apps/website/dist`, `node scripts/audit-aeo.mjs --dist apps/website/dist`)
and the llms parity check (`pnpm exec tsx scripts/check-llms-parity.ts`)
are documented opt-in developer gates; they are not separate CI jobs. The
website job runs the site browser specs, including SEO, AEO, analytics and
platform-page coverage. The theme sweep is a tested static helper with a
temporary runner recorded in the plan findings; it is not a CI command or a
browser visual test.

## Publishing to npm

`publish.yml` rebuilds every tarball from source with
`pnpm verify:packages` (publint strict, byte checks, SHA-256 recorded),
then publishes the packable packages in the wave order documented in
[RELEASE](RELEASE.md), always `--tag next`, then points `latest` at the
same versions: `latest` tracks the newest release (owner decision
2026-10-27; both name `0.3.0` once the post-merge run publishes it), so npm's package page shows the current README. Tarballs ship with signed npm provenance via
GitHub's OIDC token (`id-token: write`).

One-time setup, already done: the repository secret `NPM_TOKEN` holds a
granular access token of the publishing account with read-and-write on
the `@texuli` packages. CI tokens bypass the 2FA one-time-password flow
that blocks terminal publishes.

To release: push a tag (`v0.3.0`) or run the workflow from the
Actions tab against `main`. Never overwrite a published version; new
content means a new version.

The publish step is idempotent: it skips any `name@version` already on the
registry and retries `npm publish` up to three times, because the
provenance step can fail transiently reading the OIDC token
(`IDENTITY_TOKEN_READ_ERROR`; the 2026-10-27 `0.1.0-next.3` run stopped at
`@texuli/slides` that way). After a partial failure, re-run the workflow:
it publishes only what is missing.

Both workflows use the Node 24 action majors (`actions/checkout@v7`,
`actions/setup-node@v7`, `pnpm/action-setup@v6`,
`actions/upload-artifact@v7`); the v4 majors ran on the deprecated Node 20
runtime.

## Website deployment (texuli.com)

texuli.com is served by Cloudflare Pages from the Git repository. The
project settings are:

| Field | Value |
| --- | --- |
| Build command | `pnpm install --frozen-lockfile && pnpm build` |
| Build output directory | `apps/website/dist` |
| `NODE_VERSION` | `24` |
| `PNPM_VERSION` | `11.23.0` (only if the image picks an older pnpm) |

The build runs the same gates as local development: the examples catalog
prebuild, `astro check`, and the CSP integration (whose `_headers` file
ships in the output and is applied by Cloudflare Pages).

Pages also deploys the Functions in the repository-root `functions/`
directory: `_middleware.ts` runs on every route, and
`api/umami/[[path]].ts` is the same-origin analytics proxy
([SECURITY](SECURITY.md#15-website-edge-functions-and-analytics)).
Cloudflare applies `_headers` only to the static asset response, so the
middleware returns that response object untouched on every pass-through
request; `Vary: Accept` for the docs pages that have a Markdown twin is
written into `_headers` by the CSP integration (`varyHeaderLine` in
`apps/website/src/components/security/csp.ts`) rather than added by the
middleware. An earlier middleware rebuilt docs HTML responses to add
`Vary`, which dropped their CSP in production (PLAN_006 T-100, S-2); the
fix is in code and covered by `apps/website/tests/edge-middleware.test.ts`.
After the next deploy, confirm on a few HTML routes (a docs page with a
twin, `/`, a component page) that `Content-Security-Policy` is present
and that docs pages carry `Vary: Accept`. The variables
`PUBLIC_UMAMI_WEBSITE_ID` and `UMAMI_ENDPOINT_ORIGIN` live in the Pages
project settings, owner-provisioned; analytics stays off without them. Every push to
`main` deploys; a pull request gets a preview deployment. The per-page
social images, sitemap and robots.txt are generated at build time against
`https://texuli.com` (the `site` in `apps/website/astro.config.mjs`).

## Budget audits

The `audits` job carries no tracked reds.

- `pnpm size`: the PLAN_006 runs (T-93 and T-98, 2026-10-26) failed 26
  and 27 of 307 entries: 19 entries without a budget row (`@texuli/astro`,
  `@texuli/player`, `@texuli/slides`, `@texuli/spec`) and 7 over their
  cap (`@texuli/catalog`, `catalog/manifests/content`, `catalog/player`,
  `catalog/render/hostile`, `catalog/validate`, `charts/math`,
  `data/grid-editing`), plus `@texuli/editor/controller` 4 B over in
  T-98. The owner resolved them on 2026-10-26 (PLAN_006 follow-up) with
  rows for the 19 unbudgeted entries and raises for the 7 over-cap ones in
  `texuli.budgets.json`, plus raises for 5 rows Linux CI measured a few
  bytes over their macOS figure (`charts/cartesian`, `data/board/engine`,
  `editor/controller`, `editor/editor`, `blocks/data/renderers`). Each new
  cap is the measured size plus 4% headroom, with its reason in the row's
  `note`. A local `pnpm size` on
  2026-10-26 with those rows reported `307 entries within budget`, exit 0.
- `site-perf`: the document budgets for `/builder/`, `/charts-page/`,
  `/color-explorer/` and `/gallery-components/` were raised in commit
  `7996bbd7` (`apps/website/src/components/perf/budgets.ts`). After T-91
  and T-92 the full spec passed 10 of 10 on chromium locally, and the `/`
  page weighs 83.8 KB against its 152 KB budget.

## Known CI breakage and its fix

The `check` job failed on GitHub because
`packages/tokens/tests/library-quality.test.ts` read the pre-compact theme
port from git at `5c682dd^`, a commit that is not in `main`'s history. On
this branch the test reads a committed fixture
(`packages/tokens/tests/fixtures/library-port-original-seeds.json`)
instead of git. A green `check` run on GitHub after that change has not
been observed yet.
