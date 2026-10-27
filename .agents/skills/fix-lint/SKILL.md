---
name: fix-lint
description: Fix Biome lint and format errors, tsc or astro check errors and layer-guard findings in Texuli, including erasable-syntax and strict-mode pitfalls, without weakening any rule.
version: "1.1.0"
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob, Edit
# === Documentation (ignored by harnesses, useful for humans) ===
tier: light
intent: fix
max-files: 10
---

# Skill: Fix lint and type errors

## Goal

Make `pnpm lint` and `pnpm typecheck` pass by fixing the code, never by
disabling rules, adding `// @ts-ignore`, or editing `biome.json` or
`tsconfig.base.json` (owner-held files).

## When to use

- `pnpm lint`, `npx biome check <path>`, `pnpm typecheck`,
  `pnpm --filter <package> typecheck`, `pnpm check:layers` or `pnpm build`
  (which starts with `astro check`) fails.

## Inputs

- The failing path or package, or the failing command output.

## Steps

1. **Scope the run.**
   ```bash
   npx biome check packages/core                 # lint + format, one path
   pnpm --filter @texuli/core typecheck          # tsc -p tsconfig.json
   pnpm --filter @texuli/website typecheck       # astro check
   ```
2. **Apply safe Biome fixes** to the files you own:
   `npx biome check --write <path>`. Avoid the workspace-wide
   `pnpm lint:fix` in a shared checkout; it touches other agents' files.
   Re-run the check and fix what remains by hand.
3. **Erasable TypeScript** (`erasableSyntaxOnly`):
   - enum → `as const` array or object plus a union type
     (`const TIERS = ['developer', 'untrusted'] as const; type Tier = (typeof TIERS)[number];`);
   - constructor parameter properties → declare the field and assign it in
     the constructor body;
   - `namespace` → a module with named exports.
4. **Other strict-mode errors.**
   - `verbatimModuleSyntax`: type-only imports use `import type { … }` or an
     inline `type` marker.
   - Relative imports keep the `.ts` extension (`'./url/safe-href.ts'`).
   - `noUncheckedIndexedAccess`: `arr[0]` and regex groups are
     `T | undefined`; guard them or use `?.` (as in `safe-href.ts`).
     Non-null assertions (`!`) are allowed only in tests.
5. **Svelte 5 and Astro (`astro check`).** Replace `export let` with
   `$props()`, `on:click` with `onclick`, `$:` with `$derived`/`$effect`,
   slots with snippets. Unused-variable rules are relaxed for `.svelte` and
   `.astro` by `biome.json`; do not add more exceptions.
6. **Layer guard (`pnpm check:layers`).** `scripts/check-layers.ts` fails on
   an upward or deep `src/` import across packages, an HTML or code sink
   (`{@html}`, `eval(`, `new Function(`, `innerHTML`/`outerHTML` assignment,
   `insertAdjacentHTML(`) and a static `style="..."` attribute in shipped
   Svelte markup. Fix the import to a public subpath of a lower layer, render
   text instead of HTML, and move static styles to a class (dynamic
   `style={...}` and `style:` directives are fine). Comments and strings are
   masked, so a doc comment never trips it.
7. **A justified suppression** names the rule and the reason, like
   `// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are the target`
   in `safe-href.ts`. Use it only when the code is right and the rule is not.
8. **Re-run** the failing commands, then the tests for the area
   (`pnpm vitest run packages/<pkg>`) to confirm behavior did not change.

## Validation

```bash
npx biome check <path>
pnpm --filter <package> typecheck
pnpm vitest run packages/<pkg>
```

Root config or `packages/core` changes: `pnpm check && pnpm build`.

## Notes

- `.agents/`, `tmp/`, `.dwp/`, `.astro`, `dist` and `node_modules` are
  excluded from Biome by `biome.json`.
- If a rule looks wrong for the whole repository, propose the change to the
  owner of `biome.json` instead of suppressing it locally.
