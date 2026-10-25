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
- **`audits`** — `pnpm size` and the full `tests/e2e/site-perf.spec.ts`.
  Allowed to fail while the tracked reds below stand, so drift stays
  visible without blocking merges. A NEW failure here is a regression:
  fix it, do not raise a budget.

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

## Tracked pre-existing budget reds

These fail today on `main` and pre-date CI (verified byte-identical on
the PLAN_005 starting commit `bb6aff20`). They run only in the
non-blocking `audits` job until a dedicated performance pass retires
them:

- `pnpm size`: 18 entries without budget rows (`@texuli/astro`,
  `@texuli/player`, `@texuli/slides`, `@texuli/spec`) and 7 over budget
  (`@texuli/catalog` and three of its subpaths, `@texuli/charts` math,
  `@texuli/data` grid-editing).
- `site-perf`: document budgets of `/builder/` (30.7 > 24 KB gzip — the
  share-link, starter and editor feature growth; the editor itself loads
  as an on-demand chunk), `/charts-page/` (28.7 > 28), `/color-explorer/`
  (307.8 > 304 raw), `/gallery-components/` (884.6 > 880 raw), and the
  `/` page weight (154.8 > 152).
