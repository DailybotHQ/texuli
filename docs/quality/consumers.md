# Consumer apps: Vite, Astro and SvelteKit

**Gate:** `pnpm exec playwright test tests/consumers/consumers.spec.ts`  
**Fixtures:** `tests/consumers/fixtures/`  
**Harness:** `tests/consumers/harness.ts`

## Goal

Prove packed Texuli tarballs install and render in real consumer apps:

| Framework | Plain (tokens CSS) | Tailwind 4 + tokens preset |
| --- | --- | --- |
| Vite + Svelte 5 | `vite-plain` | `vite-tailwind` |
| Astro + Svelte | `astro-plain` | `astro-tailwind` |
| SvelteKit (static) | `sveltekit-plain` | `sveltekit-tailwind` |

Every fixture depends on **file:** tarballs of `@texuli/core`, `@texuli/tokens`,
`@texuli/primitives`, `texuli` and `@texuli/data`, produced by
`scripts/packages.ts` (the same code as `pnpm verify:packages`). Two fixtures
install more:

| Fixture | Extra packed packages | What it adds |
| --- | --- | --- |
| `astro-plain` | `@texuli/astro`, `@texuli/blocks`, `@texuli/charts`, `@texuli/media` | The packed Astro integration: `texuli({ namespace, fallbackMode })` in `astro.config.mjs`, `ContentLayout`, `Hero` and `Section`. The spec checks the appearance script key, `data-tx-theme="sky"` and `data-tx-mode="dark"` on `<html>`, the static Hero and Section content, and a token stylesheet with `@layer tx.base`. |
| `vite-plain` | `@texuli/charts` | `worker.html` builds `@texuli/charts/worker` and its entry URL as a module worker. The spec checks the emitted worker chunk still holds the handler and that it answers in the browser with results equal to the sync math. |

The harness packs `core`, `tokens`, `primitives`, `texuli`, `data`, `astro`,
`blocks`, `charts` and `media` when any of those tarballs is missing.

**Nothing is ever published** by this gate. Tarballs stay `private: true` and
live under `tmp/packages/tarballs/` (gitignored).

The shared `Smoke.svelte` mounts:

- `safeHref` from `@texuli/core/url-policy`
- `Checkbox` from `@texuli/primitives/checkbox`
- `Button` / `Badge` from `texuli`
- `Select` from `texuli/select`
- `DataGrid` from `@texuli/data/grid-core`
- `@texuli/tokens/base.css` (and Tailwind preset when enabled)

### Typecheck (Vite + SvelteKit)

After install, Vite and SvelteKit fixtures run **svelte-check** and
**tsc --noEmit** with `noUncheckedSideEffectImports` and **no** consumer-local
`declare module '*.css'`. Packed packages must ship CSS types
(sibling `*.css.d.ts`, root `css-modules.d.ts`, entry `/// <reference path>` —
see `docs/quality/packaging.md`). Astro fixtures build only (no svelte-check gate).

## Install policy

`npm install` inside each temp consumer uses:

| Flag | Why |
| --- | --- |
| *(no `--legacy-peer-deps`)* | Peer conflicts must surface. Fix Texuli `peerDependencies` (for example `svelte`) at the package source, never hide them. |
| `--ignore-scripts` | Supply-chain: lifecycle scripts are forbidden in consumer installs (see `docs/quality/supply-chain.md`). |
| `--prefer-offline` | Prefer the local npm cache for exact third-party pins. |
| `--no-fund` / `--no-audit` | Quiet CI noise; not a security substitute. |

Third-party versions in fixture `package.json` files are **exact pins** (no `^`
or `~`) so installs are reproducible once the cache is warm.

### First run

The first run on a machine needs the npm cache populated for those exact
versions **and their transitive dependencies** (for example `rolldown` under
Vite 8). With a cold or stale packument cache, `--prefer-offline` can fail
with `ETARGET` until the registry metadata is fetched once (network). Later
runs complete from cache via `--prefer-offline`. Packing the four Texuli
packages also takes a few minutes the first time; later runs reuse
`tmp/packages/tarballs/`.

**Nothing is ever published** — tarballs stay private under
`tmp/packages/tarballs/` and fixtures are never `npm publish`ed.

### Tarball assertion

After install, the harness (and the Playwright spec) assert that every
`@texuli/*` and `texuli` entry in `package-lock.json` has
`resolved: "file:…/<name>-0.0.0.tgz"` pointing at the packed tarball path —
never a registry URL.

## Run

```sh
# Prefer a free lane port; the default Playwright webServer is unused here
# (fixtures serve their own static dist).
TEXULI_E2E_PORT=4930 pnpm exec playwright test tests/consumers/consumers.spec.ts --project=chromium
```

**Stale tarballs:** the harness reuses existing tarballs in
`tmp/packages/tarballs/`. After changing a package, repack it first
(`pnpm verify:packages --filter <dir>`) or delete `tmp/packages/`, or the spec
tests the old code.

## Last verified

2026-10-25 on dev `852b8d2a`, after `pnpm verify:packages` packed and checked all
15 eligible packages (publint and attw passed; `@texuli/examples` remains excluded).
Then `npm_config_offline=true TEXULI_E2E_PORT=4965 pnpm exec playwright test
tests/consumers/consumers.spec.ts --project=chromium` passed all 7 checks (six fixture
apps plus the matrix assertion) in 58 s with the local cache. No registry was contacted.

## Limits

- The spec runs in Chromium. The consumer builds do not depend on the browser,
  but WebKit and mobile renders of the consumer pages are not run.
- Astro fixtures build only; they do not run `astro check` (no svelte-check
  gate for Astro). Adding it needs `@astrojs/check` pinned in the fixtures and
  present in the npm cache: **planned**.
- `@texuli/catalog`, `@texuli/chat`, `@texuli/tools`, `@texuli/player` and
  `@texuli/slides` are not installed by any consumer.
- Firefox is not in the Playwright matrix on this host.
