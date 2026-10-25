---
name: add-texel
description: Add a texel to @texuli/core — framework-free TypeScript behavior or policy with a public export, JSDoc contract and behavioral tests (including hostile inputs when it guards a sink).
version: "1.0.0"
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, Edit, Write
# === Documentation (ignored by harnesses, useful for humans) ===
tier: standard
intent: create
max-files: 4
---

# Skill: Add a texel

## Goal

A new piece of L0 behavior or policy in `packages/core` (for example ids,
roving focus, typeahead, a focus-scope helper, `safeImageSrc`), exported from
the barrel and covered by tests, with `pnpm check && pnpm build` green.

## When to use

- The behavior is framework-free: no Svelte, no component markup.
- Several planned components will share it.

Not for: Svelte components (the L1/L3 packages do not exist yet; ask the
`architect`), website pages (`add-website-page`).

## Inputs

- The texel name and its contract: inputs, outputs, what it rejects.

## Steps

1. **Read the model texel:** `packages/core/src/url/safe-href.ts` and
   `packages/core/tests/safe-href.test.ts`.
2. **Write the source** at `packages/core/src/<area>/<name>.ts`
   (kebab-case file, one concern per `<area>` folder):
   - a JSDoc block above the export stating the contract;
   - erasable TypeScript only (union types or `as const`, no enums or
     parameter properties);
   - no imports from Svelte, other workspace packages or runtime
     dependencies;
   - policy code fails closed (returns a safe empty value such as
     `undefined`).
3. **Export it** from `packages/core/src/index.ts`, keeping the `.ts`
   extension and marking types inline:
   `export { type MyType, myTexel } from './<area>/<name>.ts';`
4. **Test behavior** in `packages/core/tests/<name>.test.ts`, importing from
   `'../src/index.ts'` (the public boundary): normal cases, edge cases
   (empty, wrong type), and for anything guarding a sink, one hostile input
   per bypass class. Vitest only collects `packages/*/tests/**/*.test.ts`.
5. **Update docs:** the export table in `packages/core/README.md`, and move
   the texel from "Planned" to "Exists" in `docs/PRODUCT_SPEC.md` and
   `docs/ARCHITECTURE.md` (through the docs owner in a shared checkout).

## Validation

```bash
pnpm vitest run packages/core          # passed count must include the new tests
pnpm --filter @texuli/core typecheck
npx biome check packages/core
pnpm check && pnpm build               # core is shared: always the full gate
```

## Notes

- A texel that needs the DOM (focus, scroll lock) and cannot be exercised in
  Vitest's default Node environment: test its pure logic, and record the
  browser-only behavior as unverified rather than faking it. Adding a DOM
  test environment changes `vitest.config.ts` (owner-held).
- Never add another component library or any runtime dependency to `@texuli/core`.
