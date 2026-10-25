# Consumer apps against the npm registry

**Gate:** `TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/consumers/consumers-registry.spec.ts --project=chromium`  
**Fixtures:** `tests/consumers/fixtures/` (the same six as [consumers](consumers.md))  
**Harness:** `tests/consumers/harness.ts` (registry mode: `source: { kind: 'registry', version }`)

## Goal

Prove the *published* packages — not local `file:` tarballs — install from
`https://registry.npmjs.org` into the same six consumer apps (Vite, Astro and
SvelteKit × plain / Tailwind 4), build, typecheck where [consumers](consumers.md)
requires it, and render the same smoke surface. This gate failed before the
2026-10-25 publish: the registry had no version to resolve.

## How it works

1. The spec reads the version under test from `packages/core/package.json`
   (`0.1.0-next.1` at the time of writing) and requires
   `npm view @texuli/core@<version>` to resolve on the registry; otherwise it
   fails with "run the publish workflow first".
2. For each fixture, the harness rewrites every `file:PLACEHOLDER_*` specifier
   to that exact version, runs `npm install` with the same install policy as
   [consumers](consumers.md) (`--ignore-scripts`, no `--legacy-peer-deps`),
   and builds. The astro fixtures also install their transitive
   `@texuli/*` dependencies from the registry.
3. Assertions per fixture:
   - every `@texuli/*` and `texuli` entry in `package-lock.json` has
     `resolved: "https://registry.npmjs.org/…"` and exactly the version under
     test — never a `file:` path;
   - `node_modules` exists and the build emitted `index.html`;
   - the served build renders the smoke surface in Chromium (`safeHref`,
     `Checkbox`, `Button`, `Badge`, `Select`, `DataGrid`, tokens CSS).

Unlike [consumers](consumers.md), this gate **contacts the network**
(registry.npmjs.org) for the `npm view` probe and each install.

## Last verified

2026-10-25 on main `65ebff9d` with this report's registry spec and harness
changes applied (working tree): all 7 checks (six fixture apps plus the
matrix assertion) passed in 53 s against the published `0.1.0-next.1`
packages. Publishing itself is never done by this gate.

## Limits

- Chromium only; the consumer builds do not depend on the browser, but
  WebKit and mobile renders of the consumer pages are not run.
- Astro fixtures build only (no `astro check`), matching [consumers](consumers.md).
- `@texuli/catalog`, `@texuli/chat`, `@texuli/tools`, `@texuli/player` and
  `@texuli/slides` are not installed by any consumer.
- The gate only runs against a version that is really on the registry; it
  cannot validate a release before the publish workflow has run.
