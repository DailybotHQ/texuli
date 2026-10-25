# `texuli add`

**Package:** `@texuli/tools` · **Import:** `@texuli/tools/cli-add`

Copy **styled** component source into a consumer app with a provenance header.
Never copies `@texuli/primitives`. No network — only local paths.

```bash
pnpm exec tsx packages/tools/src/cli-add/cli.ts button \
  --cwd path/to/app \
  --source-root path/to/texuli-monorepo \
  --json
```

## Options

| Flag | Meaning |
| --- | --- |
| `<component>` | Addable id (`button`, `card`, …) |
| `--cwd` | Consumer project root |
| `--source-root` | Monorepo (or fixture) root that contains `packages/` |
| `--out` | Destination relative to cwd (default `src/components/texuli/<id>`) |
| `--version` | Stamped into the provenance header |
| `--force` | Overwrite existing files |
| `--dry-run` | Plan only |
| `--json` | Machine-readable `AddResult` on stdout |
| `--list` | Print addable ids |

## Provenance

Every written `.svelte` / `.ts` / `.css` file starts with an `@texuli/add` block
naming `id`, `package`, `version` and `source`. Later `texuli update` / `diff`
tasks read this block. Do not remove it.

`source` is the file's path relative to the **real** source root (both sides
through `realpath`), so a symlinked root such as macOS `/var` → `/private/var`
never stamps a parent or machine path. `add` (and `update`) refuse a file
whose stamped source would not be a plain relative path: absolute, a `.` or
`..` segment, a backslash, or a character that would break the header (NUL,
a line break, `*/`, `-->`).

## Library API

```ts
import { addComponent, listAddableIds, runAddCli } from '@texuli/tools/cli-add';

const result = await addComponent({
  id: 'button',
  cwd: '/app',
  sourceRoot: '/texuli',
  dryRun: true,
});
```

## Refusal rules

- Unknown ids
- Any resolved path under `packages/primitives`
- Existing destination files unless `--force`
- Missing source directory

## Path containment (security)

Agents run `texuli add` against consumer trees. Every write is jailable:

| Rule | Behavior |
| --- | --- |
| **outDir under cwd** | `out` is resolved with `path.resolve(cwd, out)`. Refused when the path is absolute or `path.relative(realpath(cwd), resolved)` is `..` / starts with `../`. |
| **No symlink writes** | Before each write, `lstat` the destination and every existing parent up to cwd. Any symlink is refused — even with `--force`. Never write through a link. |
| **Registry fields** | `package` and `directory` (built-in and `options.registry`) must be relative, normalized, with no `..` segment, no absolute path, and no NUL. `sourceDir` must resolve inside `sourceRoot/packages/<package>`. |
| **Source files** | Each source file’s `realpath` must stay under the component `sourceDir` (no symlink escape out of the component folder). |

Failed containment checks set `ok: false`, push a message onto `errors`, and write **nothing**.

## Tests

`pnpm vitest run packages/tools/tests/cli-add.test.ts`
