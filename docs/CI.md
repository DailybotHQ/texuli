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
- **`behavior`** — the primitives behavior suite on all three projects
  (chromium, webkit, mobile): `TEXULI_E2E_PORT=4870 pnpm exec playwright
  test tests/behavior`, after `pnpm exec playwright install --with-deps
  chromium webkit`. Failed runs upload `test-results/` as an artifact.
- **`website`** — `pnpm build` (which runs `astro check`, the examples
  catalog prebuild, sitemap/robots/social images and the CSP integration),
  `pnpm --filter @texuli/website check:csp`, then the browser e2e suite on
  chromium with the site-perf budget tests excluded (the audit job owns
  them).
- **`audits`** — `pnpm size`, then `pnpm build` and the full
  `tests/e2e/site-perf.spec.ts`. Allowed to fail while the tracked reds
  below stand, so drift stays visible without blocking merges. A NEW
  failure here is a regression: fix it, do not raise a budget. The build
  and site-perf steps run with `if: success() || failure()`, so site-perf
  is measured even while `pnpm size` is red.
- `check` and `website` check out the full history (`fetch-depth: 0`): the
  tokens library-quality test reads an older commit, and the sitemap's
  `lastmod` comes from each page's git log.

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
then publishes the 15 packable packages in the wave order documented in
[RELEASE](RELEASE.md), always `--tag next`. `latest` stays reserved for
the 1.0.0 stable release. Tarballs ship with signed npm provenance via
GitHub's OIDC token (`id-token: write`).

One-time setup, already done: the repository secret `NPM_TOKEN` holds a
granular access token of the publishing account with read-and-write on
the `@texuli` packages. CI tokens bypass the 2FA one-time-password flow
that blocks terminal publishes.

To release: push a tag (`v0.1.0-next.2`) or run the workflow from the
Actions tab against `main`. Never overwrite a published version; new
content means a new version.

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
ships in the output and is applied by Cloudflare Pages). Every push to
`main` deploys; a pull request gets a preview deployment. The per-page
social images, sitemap and robots.txt are generated at build time against
`https://texuli.com` (the `site` in `apps/website/astro.config.mjs`).

## Tracked budget reds

These run only in the non-blocking `audits` job. The numbers below are
from local runs on 2026-10-26 (PLAN_006 T-93 and T-98); CI has not
re-measured them.

- `pnpm size`: 26 of 307 entries failed in the T-93 run and 27 in the
  T-98 run.
  - 19 entries have no budget row: `@texuli/astro` (8 entries),
    `@texuli/player` (2), `@texuli/slides` (7) and `@texuli/spec` (2).
  - 7 are over their cap in both runs (gzip): `@texuli/catalog`
    (51,987 B > 49,152 B), `@texuli/catalog/manifests/content`
    (8,317 > 8,192), `@texuli/catalog/player` (16,832 > 8,192),
    `@texuli/catalog/render/hostile` (12,934 > 12,288),
    `@texuli/catalog/validate` (14,163 > 8,192), `@texuli/charts/math`
    (12,357 > 12,288) and `@texuli/data/grid-editing` (15,740 > 15,360);
    figures from the T-98 run.
  - The T-98 run adds `@texuli/editor/controller` at 18,372 B against
    18,368 B (4 B over).
  - Adding or raising budget rows is an owner decision;
    `texuli.budgets.json` is unchanged.
- `site-perf`: no tracked reds. The document budgets for `/builder/`,
  `/charts-page/`, `/color-explorer/` and `/gallery-components/` were
  raised in commit `7996bbd7` (`apps/website/src/components/perf/budgets.ts`).
  After T-91 and T-92 the full spec passed 10 of 10 on chromium, and the
  `/` page weighs 83.8 KB against its 152 KB budget.
