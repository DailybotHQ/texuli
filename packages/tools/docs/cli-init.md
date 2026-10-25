# `texuli init` and `texuli theme`

**Package:** `@texuli/tools` · **Import:** `@texuli/tools/cli-init` · **Bin:** `texuli-init`

Wire Texuli's tokens and CSS into a **Vite**, **Astro** or **SvelteKit**
project, then list, preview and apply themes from the Texuli theme library
(210 themes). Local files only: no network.

```bash
pnpm exec tsx packages/tools/src/cli-init/cli.ts init --cwd path/to/app [--theme ocean] [--json]
pnpm exec tsx packages/tools/src/cli-init/cli.ts theme list [--search "teal"] [--json]
pnpm exec tsx packages/tools/src/cli-init/cli.ts theme preview ocean [--mode dark] [--json]
pnpm exec tsx packages/tools/src/cli-init/cli.ts theme apply ocean --cwd path/to/app [--dry-run]
```

## `texuli init`

The framework is detected from `package.json`: `@sveltejs/kit`, then `astro`,
then `vite`. `--framework` overrides it.

| | Stylesheet (`--css`) | Imported from | Document (`data-tx-theme` and no-flash) |
| --- | --- | --- | --- |
| Vite | `src/texuli.css` | `src/main.ts` (or `.js`) | `index.html` |
| SvelteKit | `src/texuli.css` | `src/routes/+layout.svelte` (created if missing) | `src/app.html` |
| Astro | `src/styles/texuli.css` | `src/layouts/Layout.astro` (or `BaseLayout.astro`; created if missing) | the same layout |

What it writes:
1. **The stylesheet:** a generated header, `@import '@texuli/tokens/base.css'`,
   then the theme's compiled light and dark CSS between
   `/* texuli:theme <id> */` markers.
2. **The import** of that stylesheet in the entry, added once.
3. **The no-flash bootstrap**
   (`noFlashScript(<namespace>, 'system')`), first in `<head>` between
   `<!-- texuli:no-flash -->` markers (`is:inline` in Astro), plus
   `data-tx-theme="<id>"` on `<html>`.
4. **`texuli.config.json`:** `framework`, `css`, `entry`, `document`, `theme`,
   `namespace`.

Options: `--theme <id>` (default `enterprise-neutral`), `--css <path>`,
`--namespace <id>` (default `app`), `--force`, `--dry-run`, `--json`.

**Re-running changes nothing.** Each file reports `create`, `update` or
`unchanged`. A stylesheet that `texuli init` did not generate, or a config that
is not valid, is replaced only with `--force`.

## `texuli theme`

- `list [--search <words>]`: id, name, collection and contrast level for
  every theme (all search words must match).
- `preview <id> [--mode light|dark]`: key tokens (background, foreground,
  primary, accent, border, ring, radius, font…) and the theme's WCAG 2.x AA
  report for both modes.
- `apply <id>`: in a project with `texuli.config.json`, replaces the
  stylesheet's theme block, `data-tx-theme` and the bootstrap, then updates the
  config. Re-applying the same theme changes nothing. A stylesheet whose
  markers were removed is regenerated only with `--force`.

## Path safety

Every file `init` and `theme apply` touches goes through the shared
containment in `packages/tools/src/internal/paths.ts`.

| Rule | Refused with |
| --- | --- |
| `--css` and config paths must be relative | `must be relative` |
| …with no `..` segment | `must not contain '..'` |
| …normalized (no `./`, no `//`) | `must be normalized` |
| …with no NUL | `must not contain NUL` |
| The destination resolves inside the project root (realpath) | `escapes the project root` |
| No symlink anywhere on the destination path, **even with `--force`** | `Refusing to write through a symlink` |
| The destination is a regular file | `not a regular file` |
| `--css` names a `.css` file | `.css` |

All files are read and checked before the first write; paths are checked
again right before each write.

## Library API

```ts
import { applyProjectTheme, initProject, listThemes, previewTheme } from '@texuli/tools/cli-init';

const result = await initProject({ cwd: '/app', theme: 'ocean', dryRun: true });
```

## Tests

`pnpm vitest run packages/tools/tests/cli-init.test.ts` (34 tests, Node
environment) covers:
- the three framework fixtures in `packages/tools/tests/fixtures/cli-init/`,
  copied to temporary folders;
- idempotence and dry runs;
- `--force`;
- every path refusal (absolute, `..`, not normalized, NUL, not `.css`, a
  symlinked folder, file, entry or document, a folder as destination, unsafe
  config fields);
- unknown projects and themes;
- `theme list`, `preview` and `apply`;
- the wiring transforms;
- the CLI parser and exit codes.
