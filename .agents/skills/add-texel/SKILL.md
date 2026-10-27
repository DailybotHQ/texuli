---
name: add-texel
description: Add a texel to @texuli/core — framework-free TypeScript behavior or policy with a per-area subpath export, JSDoc contract, contract doc and behavioral tests (including hostile inputs when it guards a sink).
version: "1.1.0"
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
# === Documentation (ignored by harnesses, useful for humans) ===
tier: standard
intent: create
max-files: 6
---

# Skill: Add a texel

## Goal

A new piece of L0 behavior or policy in `packages/core` (for example ids,
roving focus, typeahead, a focus-scope helper, `safeImageSrc`), exported
through its own subpath (and the root barrel when it is light), covered by
tests and a contract doc, with `pnpm check`, the behavior suite and
`pnpm build` green.

## When to use

- The behavior is framework-free: no Svelte, no component markup.
- Several primitives or components (L1 and above) will share it.

Not for: a headless Svelte control (`@texuli/primitives`, see the
`primitive-author` agent and `skills/texuli/contribute/SKILL.md` stage B),
styled components (`texuli`), website pages (`add-website-page`).

## Inputs

- The texel name (kebab-case area) and its contract: inputs, outputs, what
  it rejects.

## Layout to follow

```text
packages/core/
├── package.json          exports "." and one subpath per texel area
├── src/index.ts          the root barrel (only light texels; see step 3)
├── src/<area>/index.ts   the area's public names
├── src/<area>/<name>.ts  one concern per file
├── docs/core-<area>.md   the contract doc
└── tests/<area>.test.ts  behavior tests at the public boundary
```

## Steps

1. **Read the model texel:** `packages/core/src/roving/` (`index.ts`,
   `roving.ts`, `typeahead.ts`) with `packages/core/tests/roving.test.ts`;
   for a policy, `packages/core/src/url/safe-href.ts` and
   `packages/core/src/url-policy/` with `packages/core/tests/url-policy.test.ts`.
2. **Write the source** at `packages/core/src/<area>/<name>.ts` and
   re-export its public names from `packages/core/src/<area>/index.ts`:
   - a JSDoc block above each export stating the contract;
   - erasable TypeScript only (union types or `as const`, no enums,
     parameter properties or namespaces);
   - no imports from Svelte, other workspace packages or runtime
     dependencies; relative imports keep `.ts`;
   - policy code fails closed (returns a safe empty value such as
     `undefined`);
   - ids never use `Math.random` at module scope.
3. **Export it:**
   - add `"./<area>": "./src/<area>/index.ts"` to
     `packages/core/package.json` `exports` (core maps each subpath to its
     TypeScript source);
   - add the names to `packages/core/src/index.ts`, keeping the `.ts`
     extension and marking types inline:
     `export { type MyType, myTexel } from './<area>/index.ts';`.
     Skip the barrel for heavy texels: the editor texels are subpath-only
     because the barrel sits near its 24 KiB budget.
4. **Test behavior** in `packages/core/tests/<area>.test.ts`, importing from
   `'../src/index.ts'` (or the area's `index.ts` for a subpath-only texel):
   normal cases, edge cases (empty, wrong type), and for anything guarding a
   sink, one hostile input per bypass class. Vitest runs in `happy-dom`, so
   DOM behavior (focus, inert, scroll lock) is testable here.
5. **Measure size:** `pnpm size --filter core/<area>`. Every core subpath is
   budgeted at 4 KiB gzip by default (`@texuli/core/*` in
   `texuli.budgets.json`, owner-held): report a texel over it to the owner
   instead of editing the budgets.
6. **Document it:** `packages/core/docs/core-<area>.md` (the contract), and
   a row in the texel table of `packages/core/README.md`; in a shared
   checkout the README row goes through its owner, as do any
   `docs/ARCHITECTURE.md` subpath changes.

## Validation

```bash
pnpm vitest run packages/core          # passed count must include the new tests
pnpm --filter @texuli/core typecheck
npx biome check packages/core
pnpm size --filter core/<area>
pnpm check                             # core is shared: always the full gate
TEXULI_E2E_PORT=<port> pnpm exec playwright test tests/behavior
pnpm build
```

## Notes

- Behavior that only a real browser shows (layout, positioning against a
  viewport, real focus traversal) belongs in the behavior suite
  (`tests/behavior`) once a primitive uses it; record it as unverified until
  then rather than faking it.
- Never add another component library or any runtime dependency to
  `@texuli/core`.
