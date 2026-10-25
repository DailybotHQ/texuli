/**
 * Types for `texuli diff` and `texuli update`: three-way merge of copied
 * components against the installed version.
 */
import type { AddableComponent } from '../cli-add/types.ts';

/** What happens to one file of the component. */
export type UpdateFileStatus =
  /** Local copy already equals the new source. */
  | 'unchanged'
  /** Not edited locally: replaced by the new source. */
  | 'fast-forward'
  /** Edited locally, unchanged upstream: the local edit is kept. */
  | 'kept-local'
  /** Edited on both sides without overlap: merged. */
  | 'merged'
  /** Edited on both sides in the same region. */
  | 'conflict'
  /** New upstream file. */
  | 'added'
  /** Removed upstream and not edited locally (deleted only with `prune`). */
  | 'removed'
  /** Removed upstream but edited locally: kept. */
  | 'removed-modified'
  /** Deleted locally, still upstream: stays deleted. */
  | 'deleted-locally'
  /** Local and new source differ but no base was given, so they cannot merge. */
  | 'needs-base'
  /** A local file without a provenance header: never touched. */
  | 'untracked';

export type UpdateFile = {
  /** Path relative to the component directory (`/` separators). */
  path: string;
  status: UpdateFileStatus;
  action: 'write' | 'would-write' | 'delete' | 'would-delete' | 'none';
  /** Unified diff from the local file to its result (empty when unchanged). */
  diff: string;
  /** Conflict regions in the result (written only with `conflicts: 'markers'`). */
  conflicts: number;
};

export type UpdateResult = {
  ok: boolean;
  id: string;
  package: string;
  /** The component directory in the consumer project. */
  outDir: string;
  /** Version in the local provenance headers, or null when none is installed. */
  installedVersion: string | null;
  /** Version stamped by the update. */
  version: string;
  files: UpdateFile[];
  /** Total conflict regions. */
  conflicts: number;
  errors: string[];
  /** True when nothing was written (`diff`, or `update --dry-run`). */
  dryRun: boolean;
};

export type UpdateOptions = {
  /** Component id (as given to `texuli add`). */
  id: string;
  /** Consumer project root. */
  cwd: string;
  /** Monorepo (or fixture) root with the **new** source under `packages/`. */
  sourceRoot: string;
  /**
   * Monorepo root with the source at the **installed** version, the merge
   * base. Without it only files that need no merge can update.
   */
  baseRoot?: string;
  /** When set, refuse unless the installed version equals it. */
  baseVersion?: string;
  /** Component directory relative to `cwd` (default `src/components/texuli/<id>`). */
  outDir?: string;
  /** Version stamped into the new headers (default `0.0.0`). */
  version?: string;
  /** Plan only; write nothing. */
  dryRun?: boolean;
  /** Delete files removed upstream that were not edited locally. */
  prune?: boolean;
  /** `refuse` (default): any conflict writes nothing. `markers`: write conflict markers. */
  conflicts?: 'refuse' | 'markers';
  /** Override the built-in registry (tests). */
  registry?: readonly AddableComponent[];
};
