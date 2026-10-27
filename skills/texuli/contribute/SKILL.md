---
name: texuli-contribute
description: Contribute a Texuli texel, primitive (with its behavior scenario), styled component, catalog manifest, examples and website page using the repository gates offline.
version: "0.2.0"
documentation_url: https://texuli.com/guides/
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
metadata:
  openclaw:
    emoji: "▣"
    homepage: https://texuli.com/guides/
    requires:
      anyBins:
        - bash
        - git
---

# Contribute a primitive or component

Use this sub-skill **inside a Texuli monorepo checkout** when the developer
wants to add or extend the design system itself — not when they only want to
*use* an existing component in an app (route that to the build/install
sub-skills).

This file is the procedure. Layer map and gate commands live in
[`references/`](references/). Every command below is local; **no network**.

## When to use

| Intent | Use this skill |
| --- | --- |
| New L0 behavior (ids, focus, URL policy helper) | Yes — start at **Stage A (texel)** |
| New L1 headless control (`@texuli/primitives`) | Yes — **Stage B** |
| New L3 styled control (`texuli/…`) | Yes — **Stage C** (needs L1 if interactive) |
| Catalog entry + examples + docs page | Yes — **Stages D–F** |
| One-line consumer app fix | No — stay on the router / edit the app only |

## Layer order (down only)

```text
@texuli/core (L0 texels)
  → @texuli/primitives (L1 headless)
    → @texuli/tokens (L2)
      → texuli (L3 styled)
        → charts / data / media / chat (L5)
          → @texuli/catalog manifests (L6)
            → apps/website pages
```

Never import a higher layer from a lower one. Import texels by **subpath**
(`@texuli/core/roving`), never the `@texuli/core` root barrel from other
packages. Styled packages import `cx` / `variants` from `texuli/cx`.

## End-to-end path

```text
texel → primitive + behavior scenario → styled component → catalog manifest → examples → website page
```

Skip stages that already exist. Primitives are written from the WAI-ARIA APG
patterns on the texels; never add another component library.

---

## Stage A — Texel (`@texuli/core`)

**Goal:** framework-free TypeScript behavior or policy with tests.

1. Read a model texel, e.g. `packages/core/src/url-policy/` (or
   `packages/core/src/roving/`) and its tests under `packages/core/tests/`.
2. Add `packages/core/src/<area>/<name>.ts` (kebab-case, one concern).
3. Export a **subpath** from `packages/core/package.json` `exports` (sorted
   keys) and a thin `packages/core/src/<area>/index.ts` if the package uses
   that pattern. Prefer subpath imports for consumers.
4. Tests: `packages/core/tests/<name>.test.ts` — normal, edge, and **hostile
   inputs** when the texel guards a sink (URL, HTML, focus escape).
5. Docs: `packages/core/docs/<name>.md` only (do **not** edit package
   `README.md` in multi-lane work).

**Gate (scoped):**

```bash
pnpm vitest run packages/core/tests/<name>.test.ts
pnpm --filter @texuli/core typecheck
npx biome check packages/core/src/<area> packages/core/tests/<name>.test.ts
```

Shared core changes that affect the whole monorepo still need `pnpm check`
when the developer asks for a full gate (owner-held root config unchanged).

---

## Stage B — Primitive (`@texuli/primitives`) + behavior scenario

**Goal:** headless Svelte 5 control bound to L0 texels, held to its WAI-ARIA
APG pattern.

1. Scaffold under `packages/primitives/src/<name>/` (Root, parts, context,
   `index.ts`). Svelte 5 runes only.
2. Export `./<name>` from `packages/primitives/package.json` (sorted).
3. Unit tests in `packages/primitives/tests/<name>.test.ts`.
4. **Behavior scenario** (required for interactive primitives):
   - `tests/behavior/scenarios/<name>/scenario.svelte` — the scenario page
   - `tests/behavior/scenarios/<name>.spec.ts` — `scenario(...)` rows
5. Docs: `packages/primitives/docs/<name>.md`.

**Gate:**

```bash
pnpm vitest run packages/primitives/tests/<name>.test.ts
pnpm --filter @texuli/primitives typecheck
npx biome check packages/primitives/src/<name> packages/primitives/tests/<name>.test.ts
# Behavior (private lane port — never 4870 / 489x)
TEXULI_E2E_PORT=4880 pnpm exec playwright test tests/behavior/scenarios/<name>.spec.ts
```

---

## Stage C — Styled component (`texuli`)

**Goal:** themed Svelte control using tokens + primitive; consumer classes win
via `@layer tx.base, tx.components`.

1. `packages/texuli/src/components/<name>/` — component, CSS in
   `@layer tx.components`, variants via `texuli` internal `cx` / `variants`
   (or `texuli/cx` from other packages).
2. Export `./<name>` from `packages/texuli/package.json` (sorted).
3. One barrel block in `packages/texuli/src/index.ts` for the folder only
   (alphabetical; change nothing else in concurrent lanes).
4. Tests: `packages/texuli/tests/<name>.test.ts`.
5. Docs: `packages/texuli/docs/ui-<name>.md` (no package README edits).

**Gate:**

```bash
pnpm vitest run packages/texuli/tests/<name>.test.ts
pnpm --filter texuli typecheck
npx biome check packages/texuli/src/components/<name> packages/texuli/tests/<name>.test.ts
pnpm size --filter texuli/<name>   # report gzip; do not edit texuli.budgets.json
```

---

## Stage D — Catalog manifest (`@texuli/catalog`)

**Goal:** agent-facing closed entry so the sink-free renderer can emit the id.

1. Add or extend a manifest under `packages/catalog/src/manifests/<family>/`
   via `defineCatalogManifest` (see existing family modules).
2. Set `agentEmittable` deliberately (default false for chrome).
3. Include `useWhen` / `dontUseWhen`, `a11y`, props schema, and **at least one
   example** when emittable.
4. Tests: extend the matching `packages/catalog/tests/manifests-*.test.ts` or
   add a focused test file.

**Gate:**

```bash
pnpm vitest run packages/catalog/tests/manifests-<family>.test.ts
pnpm --filter @texuli/catalog typecheck
```

---

## Stage E — Examples (`@texuli/examples`)

**Goal:** fixture-app demo with light/dark visual baselines.

1. `packages/examples/src/<example-id>/` — demo Svelte + `entry.ts` with
   `defineExample`.
2. Register side-effect import + named export in
   `packages/examples/src/index.ts` (alphabetical).
3. **Visual baselines** (lane port only):

```bash
git merge --no-edit dev   # before capturing, if behind
TEXULI_E2E_PORT=4880 pnpm visual:update -g <example-id>
# Inspect light and dark PNGs (dark must look dark), then commit only yours:
# tests/visual/visual.spec.ts-snapshots/<example-id>--*.png
```

**Gate:**

```bash
TEXULI_E2E_PORT=4880 pnpm exec playwright test tests/visual/visual.spec.ts -g <example-id>
```

---

## Stage F — Website page (`apps/website`)

**Goal:** docs page on the future texuli.com site that links the live example.

1. Add or update a page under `apps/website/src/pages/` (Astro).
2. English only; logical CSS; no `{@html}` on untrusted content.
3. Prefer linking the catalog example id over duplicating markup.

**Gate:**

```bash
pnpm --filter @texuli/website typecheck
# When e2e exists for the page:
# TEXULI_E2E_PORT=4880 pnpm exec playwright test tests/e2e/site-foundation.spec.ts
```

---

## Commit and handoff

- Conventional Commits with scopes: `core`, `primitives`, `texuli`, `catalog`,
  `examples`, `website`, `docs`, …
- **Stage exact paths**, never `git add -A`.
- Never push; never add a remote from this skill.
- Report: files changed, commands + results, measured bundle size for new
  lazy subpaths, known gaps.

## Offline validation of this sub-skill

From the monorepo root:

```bash
pnpm check:skill
# or
pnpm exec tsx scripts/check-skill.ts
./skills/texuli/setup.sh --verify
```

## Related references

- [`references/layers.md`](references/layers.md) — package map and import rules
- [`references/gates.md`](references/gates.md) — copy-paste gate matrix
- [`references/checklist.md`](references/checklist.md) — stage checklist
- Router: [`../SKILL.md`](../SKILL.md) · Trust: [`../TRUST.md`](../TRUST.md)
