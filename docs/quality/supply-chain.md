# Supply chain and SBOM

**Gate:** `pnpm vitest run scripts/tests/supply-chain.test.ts`  
**Implementation:** `scripts/supply-chain.ts`  
**SBOM output:** `tmp/supply-chain/sbom.cdx.json` (git-ignored under `tmp/`)

## Goal

Enforce the monorepo supply-chain rules without weakening a check:

1. **Runtime dependency allowlist** — library packages take only `workspace:*`
   internals, optional `svelte`, and the few externals named in
   `RUNTIME_EXTERNAL_ALLOWLIST` (today `@internationalized/date` on
   `@texuli/primitives`; Astro packages on `@texuli/website`).
2. **Banned runtime packages** — `clsx`, `tailwind-merge`,
   `tailwind-variants`, `@floating-ui/*` never appear in `dependencies` or
   `optionalDependencies`.
3. **No install lifecycle scripts** — workspace manifests must not define
   `preinstall`, `install`, `postinstall`, `preuninstall`, `uninstall` or
   `postuninstall`.
4. **Licenses** — every workspace package is MIT; every resolved direct
   external dep uses an SPDX id on the allowlist (MIT, Apache-2.0, BSD-*,
   ISC, 0BSD, Unlicense, CC0-1.0, BlueOak-1.0.0).
5. **CycloneDX 1.5 SBOM** — generated locally for workspace packages plus
   direct external deps (root devDependencies marked `scope: excluded`).

## Run

```sh
pnpm vitest run scripts/tests/supply-chain.test.ts
pnpm exec tsx scripts/supply-chain.ts          # human summary + write SBOM
pnpm exec tsx scripts/supply-chain.ts --json   # machine report
```

The vitest gate calls `runSupplyChain()` and fails on any finding. The SBOM
path is recreated on each run under `tmp/supply-chain/` (not committed).

## Policy source

| Rule | Source |
| --- | --- |
| Core has no runtime deps | `docs/ARCHITECTURE.md`, `docs/SECURITY.md` |
| Owned class helpers (no clsx / tailwind-merge / tailwind-variants) | lead decision |
| Owned positioning (no @floating-ui) | ARCHITECTURE |
| Lockfile owner only for installs | AI_AGENT_COLLAB |

## Limits

- The SBOM lists **direct** workspace and direct external components, not a
  full transitive lockfile explosion. Root tooling lands as `excluded`.
- License resolution reads installed `node_modules` (pnpm layout). A missing
  install reports `license-unresolved` instead of skipping.
- Does not run `pnpm audit` or download advisories (offline-first monorepo).
- Does not publish or sign artifacts; packaging is `pnpm verify:packages`.
