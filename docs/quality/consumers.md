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

Since T-std-consumers (PLAN_010), every fixture installs the packed tarball
of **every packable package** (every package `scripts/packages.ts` packs) and
imports **every exported subpath**, derived from the source `exports` maps by
`tests/consumers/surface.ts`. The kinds, the checks and what fails an app are
in [tests/consumers/README.md](../../tests/consumers/README.md). Two fixtures
add more:

| Fixture | What it adds |
| --- | --- |
| `astro-plain` | The packed Astro integration: `texuli({ namespace, fallbackMode })` in `astro.config.mjs`, `ContentLayout`, `Hero` and `Section`. The spec checks the appearance script key, `data-tx-theme="sky"` and `data-tx-mode="dark"` on `<html>` and the static Hero and Section content. |
| `vite-plain` | `worker.html` builds `@texuli/charts/worker` and its entry URL as a module worker. The spec checks the emitted worker chunk still holds the handler and that it answers in the browser with results equal to the sync math. |

The harness repacks a package when its tarball is missing or older than its
sources.

**Nothing is ever published** by this gate. Tarballs stay `private: true` and
live under `tmp/packages/tarballs/` (gitignored).

`Smoke.svelte` mounts `safeHref` (`@texuli/core/url-policy`), a primitives
`Checkbox`, `texuli` `Button`, `Badge` and `Select`, and the `@texuli/data`
grid; `Packages.svelte` mounts one component from each other UI package
(astro, blocks, charts, chat, editor, media, player, slides, workflows).

### Typecheck

Every app runs **tsc --noEmit** over every subpath except the Node-only ones;
Vite and SvelteKit apps also run **svelte-check**, with
`noUncheckedSideEffectImports` and **no** consumer-local
`declare module '*.css'`. Packed packages must ship CSS types (sibling
`*.css.d.ts`, root `css-modules.d.ts`, entry `/// <reference path>`; see
`docs/quality/packaging.md`). Third-party declaration errors are counted and
ignored; Texuli errors fail unless listed in `KNOWN_TYPE_DEFECTS`, which is
empty. The six it listed were fixed at the source: four `@texuli/blocks`
interactive components imported a type named like the component (TS2440 in
the emitted `.svelte.d.ts`; guarded for every package by
`scripts/tests/svelte-self-named-imports.test.ts`), and the `@texuli/primitives`
accordion and slider root-props unions made `keyof` too complex (TS2590;
guarded by `packages/primitives/tests/root-props.types.ts`).

## Install policy

`npm install` inside each temp consumer uses:

| Flag | Why |
| --- | --- |
| *(no `--legacy-peer-deps`)* | Peer conflicts must surface. Fix Texuli `peerDependencies` (for example `svelte`) at the package source, never hide them. |
| `--ignore-scripts` | Supply-chain: lifecycle scripts are forbidden in consumer installs (see `docs/quality/supply-chain.md`). |
| `--offline` (tarball mode) | Never fetch: a third-party pin missing from the npm cache fails with `ENOTCACHED` and is reported. |
| `--prefer-offline` (registry mode) | Prefer the local npm cache; the registry spec must reach npm for the Texuli packages. |
| `--no-fund` / `--no-audit` | Quiet CI noise; not a security substitute. |

Third-party versions in fixture `package.json` files are **exact pins** (no `^`
or `~`) so installs are reproducible once the cache is warm.

### First run

Tarball mode needs the exact third-party versions **and their transitive
dependencies** (for example `rolldown` under Vite 8, `astro` under
`@texuli/astro`) in the npm cache; on a cold cache the install fails with
`ENOTCACHED` instead of downloading. Warm it once with the registry spec or
a networked `npm install` of a fixture.

### Tarball assertion

After install, the harness (and the Playwright spec) assert that every
packable package's entry in `package-lock.json` has
`resolved: "file:…/<name>-<version>.tgz"` pointing at the packed tarball of
its workspace version, never a registry URL.

## Run

```sh
pnpm verify:packages && TEXULI_E2E_PORT=4953 pnpm exec playwright test tests/consumers/consumers.spec.ts --project=chromium
```

## Last verified

2026-10-28 on `feat/plan-010-universal-generator` (`a3a5586d` plus the
working tree), T-std-consumers: `bash -c 'pnpm verify:packages &&
TEXULI_E2E_PORT=4953 pnpm exec playwright test tests/consumers --project
chromium'` exited 0 in 6 min 30 s wall. `pnpm verify:packages` passed for 21
packages; Playwright reported 14 passed in 3.0 min: the six tarball-mode apps
plus the matrix check (each app installed all 21 tarballs with `--offline`
and imported 372 subpaths), and the seven registry-mode checks against the
published `0.5.0` (network). A deliberately defective `@texuli/chat` tarball
(the `texuli` dependency removed from its packed manifest) failed
`sveltekit-plain` with 49 undeclared-import problems while its build alone
still passed; the good tarball was restored.

## Limits

- The spec runs in Chromium. The consumer builds do not depend on the browser,
  but WebKit and mobile renders of the consumer pages are not run.
- Astro fixtures run tsc but not `astro check` (no svelte-check gate for
  Astro). Adding it needs `@astrojs/check` pinned in the fixtures and present
  in the npm cache: **planned**.
- The Node-only subpaths are imported by plain Node but not type-checked:
  their declarations reference `@types/node`, which this host's npm cache
  cannot install offline (`undici-types` is missing).
- Firefox is not in the Playwright matrix on this host.
