# Contribute — stage checklist

Copy this into the task report. Mark only stages you touched.

## A — Texel

- [ ] Source under `packages/core/src/<area>/`
- [ ] Subpath export in `packages/core/package.json`
- [ ] Hostile-input tests if sink-related
- [ ] `packages/core/docs/<item>.md` (no README edit)
- [ ] `pnpm vitest run packages/core/tests/<name>.test.ts` green

## B — Primitive + behavior scenario

- [ ] `packages/primitives/src/<name>/` + package export
- [ ] Unit tests
- [ ] `tests/behavior/scenarios/<name>.spec.ts` + `scenario.svelte`
- [ ] Docs under `packages/primitives/docs/`
- [ ] Behavior rows on `TEXULI_E2E_PORT=<lane>` green

## C — Styled

- [ ] `packages/texuli/src/components/<name>/` + CSS `@layer tx.components`
- [ ] `cx` / `variants` only (no clsx / tailwind-merge)
- [ ] One alphabetical barrel export block
- [ ] Package `exports` key sorted
- [ ] Measured `pnpm size --filter texuli/<name>` reported
- [ ] Docs `packages/texuli/docs/…` only

## D — Manifest

- [ ] Family manifest updated; `agentEmittable` intentional
- [ ] Catalog tests green
- [ ] Spec vocabulary refreshed and regenerated; `pnpm vitest run packages/spec` green
- [ ] Website catalog and llms snapshots regenerated

## E — Examples

- [ ] Example registered in `packages/examples`
- [ ] Visual baselines light + dark committed (dark looks dark)
- [ ] Port was lane-private for `visual:update`

## F — Website

- [ ] Page under `apps/website` when docs surface required
- [ ] Website typecheck green

## Ship

- [ ] Conventional Commit, exact paths
- [ ] No push / no remote
- [ ] `pnpm check:skill` still green after skill pack edits
