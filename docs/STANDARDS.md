# Coding standards — Texuli

These rules come from the real configuration (`tsconfig.base.json`,
`biome.json`) and the code that exists today. `AGENTS.md` lists the
mandatory subset; this file explains them.

## TypeScript

- **Strict and erasable.** `tsconfig.base.json` sets `strict`,
  `erasableSyntaxOnly`, `verbatimModuleSyntax`, `isolatedModules` and
  `noUncheckedIndexedAccess`. No enums (use an `as const` array or object plus
  a union type), no constructor parameter properties, no namespaces.
- **Type-only imports and exports** are marked: `import type { … }` or the
  inline form used in `packages/core/src/index.ts`:
  `export { type HrefTrust, safeHref } from './url/safe-href.ts';`
- **Relative imports keep the `.ts` extension** (`'./url/safe-href.ts'`,
  `'../src/index.ts'`); `allowImportingTsExtensions` is on.
- **Packages export source.** A package's `exports["."]` points to
  `./src/index.ts`. The barrel is the public API; anything not exported from
  it is private.
- **Indexed access is `T | undefined`.** Guard it or use `?.`
  (`safe-href.ts` reads `exec(href)?.[1]?.toLowerCase()`). Non-null
  assertions (`!`) are allowed only in tests (Biome override for
  `**/tests/**` and `**/*.test.ts`).
- **Fail closed in policy code.** Texels that judge input return a safe empty
  value (`safeHref` returns `undefined`) instead of throwing, and document
  the contract in a JSDoc block above the export.

## Svelte 5 and Astro

- **Runes only:** `$props()`, `$state`, `$derived`, `$effect`, `onclick`,
  snippets. No `export let`, no `on:click`, no `$:`, no slots.
- **No `{@html}`** on anything that comes from props, content or an agent.
- **Astro components** keep logic in the frontmatter and styles scoped;
  global tokens live on `:root` with a `prefers-color-scheme: dark` variant
  (see `apps/website/src/pages/index.astro`).

## CSS

- **Logical properties** where direction matters: `inline-size`,
  `block-size`, `margin-inline`, `margin-block`, `padding-inline`,
  `inset-inline-start`, `border-inline-start`. The website already follows
  this (`max-inline-size`, `margin-inline`, `margin-block-start`).
- Colors and surfaces come from custom properties, never hard-coded inside a
  component when a token exists.
- Respect `prefers-color-scheme`; planned components also respect
  `forced-colors` and `prefers-reduced-motion`.

## Formatting and lint (Biome 2.5.15)

- Two-space indent, line width 100, single quotes, semicolons, ES5 trailing
  commas. Biome is the formatter of record; do not hand-format against it.
- `useImportType` is off (the compiler enforces type imports through
  `verbatimModuleSyntax`), and unused-variable rules are relaxed for
  `.svelte` and `.astro` files because the compiler sees template usage.
- Suppressions need a reason, as in `safe-href.ts`:
  `// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are the target`.
- Never weaken `biome.json` or `tsconfig.base.json` to make a check pass;
  they are owner-held files.

## Naming

- Files: `kebab-case.ts` (`safe-href.ts`); tests mirror the name
  (`tests/safe-href.test.ts`). Svelte and Astro components: `PascalCase`
  (`TexelsDiagram.astro`).
- Packages: `@texuli/<name>` for workspace packages; the planned styled
  package is the unscoped `texuli`.
- Folders inside `src/` group a concern (`src/url/`).

## Accessibility

- Every interactive element has an accessible name; icon-only controls need
  a label.
- Keyboard: Tab order follows visual order; Escape closes the topmost layer
  only; focus returns to the trigger when a layer closes.
- Overlays make the outside `inert` and lock scroll while modal.
- Decorative graphics carry `aria-hidden="true"` (as in
  `TexelsDiagram.astro`).

## Dependencies

- No runtime dependency on another component library. No runtime dependency
  in `@texuli/core`.
- Adding a dependency means editing the package's `package.json` and asking
  the lockfile owner to run `pnpm install`.

## Honesty in docs

- Mark planned work as planned. Never document a command you did not run or
  a number you did not measure.
