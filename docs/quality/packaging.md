# Packaging, publint and attw

`pnpm verify:packages` (`scripts/packages.ts`) builds, packs and checks every library package the way npm would publish it, **without publishing anything**.

At the time of this report (before the first publication), the tarballs kept `private: true`. Since the first publication, `scripts/packages.ts` drops `private` from the packed manifests and `publish.yml` publishes them.

```sh
pnpm verify:packages                        # every package
pnpm verify:packages --filter core,tokens   # by directory or package name
pnpm verify:packages --json                 # the report as JSON
```

## What it does

All packages are covered except `@texuli/examples` (demo code). Each package goes through these steps:

1. **Build**
   - `@sveltejs/package` compiles `src/` into `tmp/packages/stage/<dir>/dist`, using a generated tsconfig that extends the package's own and sets `rewriteRelativeImportExtensions`, so `./x.ts` imports become `./x.js` in JavaScript.
   - In emitted declarations, relative `.ts` specifiers become `.js` too.
   - Side-effect CSS imports (`import './x.css'`, which svelte2tsx copies from component scripts) are dropped from declarations only. The JavaScript and Svelte files keep them.
   - **CSS types ship self-sufficient for consumers** (FIX-css-types-ship): every packed `.css` file gets a sibling `.css.d.ts` (`export {}`) when missing; a root `css-modules.d.ts` (`declare module '*.css'`) is written; every entry `index.d.ts` and every `*.svelte.d.ts` gets `/// <reference path="…/css-modules.d.ts" />`. A consumer running svelte-check/tsc against packed tarballs needs no local `*.css` ambient of their own.
   - **Any declaration diagnostic fails the package:** svelte-package itself only warns.
2. **Manifest**
   - The published `package.json` is *derived* from the source one, so there is no hand-written publish map to drift from the source `exports`:
     - `./src/**.ts` targets become `./dist/**.js` (`types` becomes `.d.ts`);
     - `.svelte` and `.css` keep their names, and `.svelte` `types` become `.svelte.d.ts`;
     - a bare `.css` subpath gains a `types` condition pointing at an `export {}` declaration, so TypeScript resolves the side-effect import;
     - `bin` targets map the same way;
     - `workspace:` ranges become the exact workspace version;
     - `files` is `["dist"]`, and scripts and dev dependencies are dropped;
     - `README.md` and the repository `LICENSE` are added.
   - A target outside `src/`, or an unknown file type, is reported, never guessed.
3. **Pack**
   - `npm pack` writes the tarball into `tmp/packages/tarballs/`.
   - Every tarball's SHA-256 is listed in `tmp/packages/SHA256SUMS`, and the full report goes to `tmp/packages/report.json`.
4. **Check**
   - [publint](https://publint.dev) runs in strict mode on the tarball: warnings fail.
   - [arethetypeswrong](https://arethetypeswrong.github.io) checks types with the ESM-only policy:
     - CommonJS and `node10` resolution are out of scope, because the packages are ESM-only;
     - every other problem fails, except the one named exception below.

### The one attw exception

`svelte-component-declaration` (the same exception Protoyard uses):
- **The problem:** TypeScript's `node16` mode never resolves `./X.svelte`, because it looks for `X.d.svelte.ts`. svelte-package emits `X.svelte.d.ts`, which bundler resolution, Vite and svelte-check all read.
- **What is dropped:** only an `InternalResolutionError` under `node16` for a relative `.svelte` import, and only when both the component and its `.svelte.d.ts` are in the tarball. A missing declaration still fails.
- **Visibility:** every dropped problem is counted per package in the output (`exception svelte-component-declaration: N`).

## Findings fixed at their source

The first run failed 9 of 11 packages. Each finding was fixed where it came from, never by relaxing a check:

| Finding | Cause | Fix |
| --- | --- | --- |
| No `index.d.ts` for `@texuli/primitives` calendar, date-picker, navigation-menu, select, tooltip and tree, and `texuli` combobox, menus, navigation, popover, select and sheet | Compound objects (`export const Select = { Root, … }`) had inferred types that name each component's private `Props` interface, which declaration emit cannot write (TS4023). texuli combobox failed with no diagnostic at all. The calendar's inferred type wrote an extensionless `import("../internal")` that `node16` cannot resolve. | Each compound gets an explicit type of `typeof` its parts: `readonly` where it was frozen or `as const`, and `Omit<…> & {…}` for sheet's spreads |
| No declaration for `@texuli/media` `ImageEditor.svelte` | `ComponentProps<typeof Editor>` named Editor's private `Props` | Editor exports `ImageEditorProps`, and the shell uses it |
| Declaration emit silently skipped files beside a CSS declaration | 12 `*.css.d.ts` files declared `declare module './x.css' {}`, a relative ambient module name, which TypeScript rejects | Normalized to `export {};`, the form the other CSS declarations already used |
| publint: `default` before `import` in `@texuli/primitives` `.` and `./date-field` | Condition order | `import` now comes before `default` |
| publint: the `@texuli/tools` bins are not executable | No shebang | `#!/usr/bin/env node` on the three CLI entries |
| attw `NoResolution` for `@texuli/tokens` `./forced-colors.css` and `./tailwind/preset.css` | CSS subpaths had no `types` | The derived manifest adds the `export {}` declaration (above) |

## Results

On 2026-10-25, `pnpm verify:packages` passed for all 15 packable packages
on dev `852b8d2a`; `@texuli/examples` remains private and excluded. The run
reported 15 successful publint/attw checks and the named
`svelte-component-declaration` exceptions. Tarballs and SHA-256 digests are
run artifacts under ignored `tmp/packages/`; nothing was published. Exact
hashes and per-run tarball sizes are intentionally not copied because they
change with source content.

## sideEffects (FIX-tokens-entry-weight)

Every packable package sets `"sideEffects": ["**/*.css"]` so bundlers drop unused
JavaScript when a consumer imports one named export (for example `applyTheme`
from `@texuli/tokens` or `@texuli/tokens/css`). `@texuli/examples` also lists the
registry entry files that self-register examples. CSS imports remain side-effectful.

## Requirements and limits

- **Dev dependencies:** `publint` and `@arethetypeswrong/core` must be root dev dependencies. They are loaded only when checking, so the unit tests (`scripts/tests/packages.test.ts`) run without them.
- **Not checked:** the tarballs are not installed into a clean consumer app, and nothing exercises Node's own ESM loader on them. Svelte components ship as `.svelte` source with TypeScript script blocks, so they must be compiled by a Svelte 5 toolchain (Vite, SvelteKit), as with every Svelte library.
- **Ignored resolutions:** CommonJS and `node10` resolution are ignored by policy, because the packages are ESM-only.
- **Duration:** this 15-package run completed in about 3 minutes on a loaded machine.
