# CI — GitHub Actions and deployment

The repository runs three GitHub Actions workflows: CI, npm publishing and the skill release. Checks run on every push
to `main` and every pull request; publishing runs after CI passes on
`main`, or on demand. The website deploys separately through Cloudflare Pages' own Git
integration.

## Workflows

| Workflow | File | Trigger | Jobs |
| --- | --- | --- | --- |
| CI | [.github/workflows/ci.yml](../.github/workflows/ci.yml) | push to `main`, pull requests | `check`, `behavior`, `website`, `audits`, `setup-smoke-macos`; `mcp-remote-smoke` on pushes to `main` only |
| Publish packages | [.github/workflows/publish.yml](../.github/workflows/publish.yml) | CI success on a push to `main` (a merged PR), manual dispatch | `publish` |
| Skill release | [.github/workflows/skill-release.yml](../.github/workflows/skill-release.yml) | `workflow_run` after a successful CI run for a push to `main` | `release` (`contents: write`), `smoke` (read-only) |

- **`check`** — `pnpm check` (Biome lint, typecheck, unit and component
  tests, layer guard, and `pnpm check:surfaces`, which fails when the
  server card, the llms Tools section, the ops docs tables or the
  `/mcp-server/` data drift from the operations registry) plus `scripts/supply-chain.ts`, `scripts/check-docs.ts`,
  `pnpm check:skill` and `shellcheck skills/texuli/setup.sh` (the skill's
  only shell script; shellcheck ships on the Ubuntu image).
- **`mcp-remote-smoke`** — only on pushes to `main`, after `check`, and
  never on pull requests. Cloudflare Pages deploys the site and
  `functions/mcp.ts` outside GitHub Actions, so the job runs
  `scripts/mcp-remote-smoke.sh`: a read-only `tools/list` POST to
  `https://texuli.com/mcp` with curl, compared with the remote tool names
  of the committed server card (generated from the registry), retried
  every 30 s up to 20 times while the deploy of the commit rolls out. It is
  `continue-on-error`, so a slow or failed deploy never blocks publishing;
  a drift shows as a failed job with an error annotation. The endpoint is
  live from release 0.9.0, deployed from `main`. Tests: `scripts/tests/mcp-remote-smoke.test.ts` (a local
  stand-in server).
- **`setup-smoke-macos`** — on `macos-latest`, confirms `/bin/bash` is
  3.2 and runs the skill's `setup.sh` under it: `--help`, `--version`,
  `--verify`, then for every host from `--list-hosts` a dry run, an install
  into a temp home, an idempotent re-run (`Already installed: no change.`)
  and `--verify` of the installed copy.
- **Skill release** — releases the agent skill apart from npm: on the
  first push to `main` after CI succeeds, when commits since the last
  `skill-v` tag touch `skills/texuli/` and the head commit is not a release
  commit or `[skip release]`. The `release` job plans the version with
  `scripts/check-skill.ts --release-plan`, stamps it, pushes the release
  commit and the `skill-vX.Y.Z` tag atomically, builds the archive and its
  `SHA256SUMS`, and creates the GitHub Release; `smoke` installs the tag
  with the skills CLI and checks the version and checksums. The latest skill
  release is the `skill-v0.3.16` tag (2026-11-03). Details: [RELEASE](RELEASE.md#skill-release);
  tests: `scripts/tests/skill-release.test.ts`.
- **`behavior`** — the primitives behavior suite on chromium and webkit
  (the phone-specific rows run in a Pixel 7 context inside the chromium
  test, see
  [tests/behavior/README.md](../tests/behavior/README.md)): `TEXULI_E2E_PORT=4870 pnpm exec playwright
  test tests/behavior`. Failed runs upload `test-results/` as an artifact.
- **`website`** — `pnpm build` (which runs `astro check`, the examples
  catalog prebuild, sitemap/robots/social images and the CSP integration),
  `pnpm --filter @texuli/website check:csp`, the Markdown twin parity check
  (`pnpm exec tsx scripts/check-md-parity.ts --strict`), then the browser e2e suite on
  chromium with the site-perf budget tests excluded (the audit job owns
  them). The job is a six-way matrix: each runner builds the site and runs
  one shard of the same suite. `tests/e2e/shards.json` deals the spec files
  by measured CI time (about 35 minutes of summed test time, about 1.5
  minutes per shard on four workers); `scripts/tests/e2e-shards.test.ts`
  fails when a spec is in no shard or in two, so a new spec must be added
  to a shard. The a11y page sweep is three files (`a11y-site-1..3.spec.ts`)
  so it spreads over shards. `check:csp` and the twin parity check run on shard 1. Locally,
  `pnpm exec playwright test tests/e2e` runs every spec.
- **Runners and browsers:** every CI job except `setup-smoke-macos` (on `macos-latest`) runs on `ubuntu-24.04` with a
  `timeout-minutes` limit (15 for `check`, which ran 6.5 to 9.5 minutes in 2026-11). `behavior`, `website` and `audits` run in
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
[RELEASE](RELEASE.md), always `--tag latest`: `latest` tracks the newest
release (owner decision 2026-10-27), so npm's package page shows the
current README. Tarballs ship with signed npm provenance via GitHub's OIDC
token (`id-token: write`). The workflow no longer moves `next`
([RELEASE](RELEASE.md#dist-tags)).

`publish.yml` lists `@texuli/drag`, `@texuli/workflows` and
`@texuli/deck` (all in development) ahead of the packages that depend on
them (owner decision 2026-10-27), `@texuli/editor` (in development)
after `texuli`, `@texuli/document` after `@texuli/primitives` (before
`@texuli/tools`, which imports it), `@texuli/pages` after
`@texuli/player`, `@texuli/forms` and `@texuli/canvas` (in development)
after `@texuli/editor` (forms needs `@texuli/core` and `texuli`; canvas
also needs `@texuli/deck`, `@texuli/document` and `@texuli/drag`), and
`@texuli/sheets` (in development) after `@texuli/blocks`, once
`@texuli/date` and `@texuli/data` are out; no published package imports
the three (the catalog and the player take their checks and painters from
the host); and `@texuli/mcp` (in development) right after
`@texuli/tools`, which it pins exactly. A manual `workflow_dispatch` run on `main`
(run 40616266068, 2026-10-28 UTC) published drag and workflows for the
first time as `0.3.0`; `@texuli/deck` was first published in `0.4.0`, and
`@texuli/editor` was first published in `0.5.0`, `@texuli/document`
and `@texuli/pages` in `0.7.0`, and `@texuli/forms`, `@texuli/canvas` and
`@texuli/sheets` in `0.8.0`, and `@texuli/mcp` in `0.9.0`; in `0.10.0`
and the 0.11, 0.12 and 0.13 lines all 26 packable packages move together. A pre-flight step refuses the run,
before the first `npm publish`, when any listed package is still `0.0.0`.
The publish loop
skips versions npm already has, so a package changed since its published
version needs a new version first
([RELEASE](RELEASE.md#publication-waves)).

**Authentication: npm trusted publishing (OIDC), no stored token.** Each of
the 26 published packages trusts `publish.yml` of `DailybotHQ/texuli` in
the `npm` environment (`npm trust github <package> --file publish.yml
--repo DailybotHQ/texuli --env npm --allow-publish`, run by the publishing
account, which confirms with its 2FA; npm keeps one trusted publisher per
package, so changing it means `npm trust revoke` first). At publish time npm
exchanges the job's GitHub OIDC token for a short-lived publish right, so
there is no `NPM_TOKEN` secret to leak. The GitHub environment `npm` admits
deployments from `main` only, so a run of a changed workflow on another
branch gets no environment claim and npm refuses it. Trusted publishing
covers `npm publish` only: `npm dist-tag` still needs the publishing
account, from a terminal. The job installs npm `11.20.0` first (trusted
publishing needs 11.5.1 or later). The former CI token ("Texuli Access
Token") was revoked on npm on 2026-11-02. Every published package is set to "Require
2FA and disallow tokens" (`npm access set mfa=publish`, applied on
2026-11-03, one 2FA check per package), so npm refuses any token of the
publishing account; trusted publishing keeps working. The repository ruleset
"main: no force-push or deletion" blocks rewriting or deleting `main`. It
does not require pull requests, so writers can still push to `main`
directly: GitHub does not let the Actions integration bypass a ruleset, and
the skill release pushes its release commit to `main`
([RELEASE](RELEASE.md#skill-release)). Requiring pull requests needs an
`AUTOMATION_GITHUB_TOKEN` secret that may bypass the rule first.

To release: merge a pull request that bumps the versions into `main`.
Every pull request runs the full CI; once CI passes on the merge commit,
`publish.yml` starts on its own (`workflow_run`) and publishes every
`name@version` npm does not have yet, so a merge without a version bump
publishes nothing. A manual run from the Actions tab against `main` still
works; a manual run on any other branch is refused by the environment. Tag
pushes no longer start a publish (they would bypass the main-only rule). Never overwrite a published version; new
content means a new version.

The publish step is idempotent: it skips any `name@version` already on the
registry and retries `npm publish` up to three times, because the
trusted publishing and provenance can fail transiently reading the OIDC token
(`IDENTITY_TOKEN_READ_ERROR`; the 2026-10-27 `0.1.0-next.3` run stopped at
`@texuli/slides` that way). After a partial failure, re-run the workflow:
it publishes only what is missing.

The last step, "Verify the release on npm", checks every package on the
registry: its version is `latest` and carries a provenance attestation.
npm's metadata can lag a few minutes behind a publish, so the step polls
every 30 seconds for up to ten minutes before it fails the run.

All three workflows use the Node 24 action majors (`actions/checkout@v7`,
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
directory: `_middleware.ts` runs on every route,
`api/umami/[[path]].ts` is the same-origin analytics proxy
([SECURITY](SECURITY.md#15-website-edge-functions-and-analytics)), and
`mcp.ts` is the remote MCP (below).
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
project settings, owner-provisioned (set for production, so texuli.com
sends Umami events); Umami analytics stays off without them.
Cloudflare Web Analytics is a Cloudflare account setting: the edge injects
its beacon into production pages, and the page CSP allows its script and
report origins (`CLOUDFLARE_WEB_ANALYTICS` in `csp.ts`). Every push to
`main` deploys; a pull request gets a preview deployment. The per-page
social images, sitemap and robots.txt are generated at build time against
`https://texuli.com` (the `site` in `apps/website/astro.config.mjs`). The
middleware answers `/robots.txt` itself for every client with
`Cache-Control: no-store`: the built policy, or a variant without the
non-standard lines for Lighthouse-family audits, so the edge cache never
hands one rendering to the other audience.

The remote MCP endpoint (`functions/mcp.ts`, PLAN_011 T-mcp-remote) deploys
with the site from `main` and is live from release 0.9.0. It needs no
environment variable, binding or secret: Pages bundles it with the other
Functions, it answers `/mcp`, and the middleware answers `/.well-known/mcp`
with the same server. It sets its own CSP, `nosniff`, `no-store`,
`noindex` and CORS headers, because `_headers` does not apply to Function
responses ([SECURITY](SECURITY.md#21-remote-mcp-endpoint)). Its bundle is
budgeted in `pnpm size` as `functions/mcp`. After the first deploy,
confirm by hand that `POST https://texuli.com/mcp` answers `initialize`
and `tools/list` with the `edge` operations, that a `GET` gets `405`, and
that the security headers are present; the `mcp-remote-smoke` job (above)
compares the live `tools/list` with the registry after each deploy from `main`.
The optional Cloudflare rate-limiting rule for `/mcp` is an owner action
in the dashboard, described in the same SECURITY section. The DNS side of
agent discovery is account configuration too, not in the repository: the
texuli.com zone is signed with DNSSEC and carries DNS-AID `SVCB` records
for `_index._agents.texuli.com` and `_mcp._agents.texuli.com` (target
`texuli.com`, `alpn=mcp`, `port=443`)
([SECURITY](SECURITY.md#22-agent-discovery-files-texulicom)).

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
