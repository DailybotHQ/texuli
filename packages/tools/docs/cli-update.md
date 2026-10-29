# `texuli diff` and `texuli update`

**Package:** `@texuli/tools` · **Import:** `@texuli/tools/cli-update` · **Bin:** `texuli-update`

These commands update a component copied with [`texuli add`](cli-add.md) to a new Texuli source by **three-way merge**:
- **base:** the source at the installed version (from the provenance headers);
- **local:** the consumer's copy, with their edits;
- **upstream:** the new source.

They use the local filesystem only; there is no network.

```bash
pnpm exec tsx packages/tools/src/cli-update/cli.ts diff button \
  --cwd path/to/app --source-root path/to/texuli-new --base-root path/to/texuli-installed

pnpm exec tsx packages/tools/src/cli-update/cli.ts update button \
  --cwd path/to/app --source-root path/to/texuli-new --base-root path/to/texuli-installed \
  --version 0.5.0 [--base-version 0.4.0] [--dry-run] [--prune] [--conflicts markers] [--json]
```

- `diff` prints each file's status and a unified diff from the local file to the file `update` would write. It never writes.
- `update` applies the plan. On a refusal, it writes **nothing**: not even the files that would merge cleanly.

## Options

| Flag | Meaning |
| --- | --- |
| `diff` / `update` | The command |
| `<component>` | The addable id used with `texuli add` |
| `--cwd` | Consumer project root |
| `--source-root` | Root with the **new** source under `packages/` |
| `--base-root` | Root with the source at the **installed** version (the merge base) |
| `--base-version` | Refuse unless the headers' installed version equals this |
| `--out` | Component directory relative to cwd (default `src/components/texuli/<id>`) |
| `--version` | Version stamped into the new headers (default `0.0.0`) |
| `--conflicts` | `refuse` (default) or `markers` |
| `--prune` | Delete files removed upstream that were not edited locally |
| `--dry-run` | `update` plans only |
| `--json` | `UpdateResult` on stdout |

## What happens to each file

The comparison uses the file **without** its provenance header, so a header change is never a local edit.

| Status | When | Action |
| --- | --- | --- |
| `unchanged` | Local equals the new source | The header is restamped with the new version |
| `fast-forward` | Local equals the base | Replaced by the new source |
| `kept-local` | Upstream equals the base | The local edit is kept and the header restamped |
| `merged` | Both sides changed different regions | The merged text is written |
| `conflict` | Both sides changed the same region | Refused, or written with diff3 markers when `--conflicts markers` is set |
| `added` | A new upstream file (or the component is not installed) | Written |
| `removed` | Removed upstream, local equals the base | Kept, or deleted with `--prune` |
| `removed-modified` | Removed upstream, edited locally | Kept |
| `deleted-locally` | The consumer deleted a file that is still upstream | Stays deleted |
| `needs-base` | Local differs from the new source and no `--base-root` was given | `diff` reports it; `update` refuses |
| `untracked` | A local file with no provenance header for this component | Never read for merging or touched |

### Conflict markers

The markers carry the base, so the consumer sees all three versions:

```text
<<<<<<< local
  <strong>{label}</strong>
||||||| base 0.4.0
  {label}
=======
  <span class="tx-button-label">{label}</span>
>>>>>>> texuli 0.5.0
```

## Merge

- **Line diff:** a line-based Myers diff (`matchLines`), then diff3 chunking (`merge3`).
- **Line endings:** lines keep their endings, so CRLF files and a missing final newline survive.
- **Each region resolves one way:**
  - only one side changed it: that side wins;
  - both made the same change: it is applied once;
  - anything else is a conflict.
- **Large changes:** past 4,000 edits between two versions of one file, only the common prefix and suffix are matched. The middle then conflicts as a whole instead of costing quadratic memory.

## Safety

Updates use the same containment as `texuli add` (`src/internal/paths.ts`):
- the out directory must be inside cwd;
- there must be no symlink on any path read or written (a symlinked component directory is refused);
- registry fields are validated;
- source files must stay inside the component's source directory.

Primitives are refused. The provenance headers must agree on one installed version; otherwise the update is refused.

## Library API

```ts
import { diffComponent, updateComponent } from '@texuli/tools/cli-update';

const plan = await diffComponent({ id: 'button', cwd, sourceRoot, baseRoot, version: '0.5.0' });
const result = await updateComponent({ id: 'button', cwd, sourceRoot, baseRoot, version: '0.5.0' });
```

`merge3`, `unifiedDiff`, `matchLines`, `splitLines` and `parseProvenance` are exported too.

## Tests

`pnpm vitest run packages/tools/tests/cli-update.test.ts` (8 grouped tests, Node). Each scenario builds a v1 and a v2 source tree and an app with v1 added through the real `addComponent`, in temporary directories. They cover:
- every status;
- the refusal leaving the files byte-identical;
- markers, prune and a second no-op update;
- a missing base and a version mismatch;
- path escape, a symlinked component directory, primitives and mixed versions;
- the CLI.

## Limits

- **The base is not stored:** the consumer passes a source tree at the installed version (`--base-root`). The headers record the version, not the content.
- **Line-level only:** there is no word-level or syntax-aware merging.
- **Text files only:** every file is read as UTF-8.
