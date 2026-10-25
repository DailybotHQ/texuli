/**
 * Types for `texuli add` — copy styled component source into a consumer app.
 */

/** One file the add command will write. */
export type AddFilePlan = {
  /** Path relative to the component source directory. */
  relativePath: string;
  /** Absolute path of the source file. */
  from: string;
  /** Absolute path of the destination file. */
  to: string;
  /** Bytes of the source before the provenance header. */
  sourceBytes: number;
};

/** Result of one `add` run (human or `--json`). */
export type AddResult = {
  ok: boolean;
  /** Component id requested. */
  id: string;
  /** Package that owns the styled source. */
  package: string;
  /** Directory written under the consumer project. */
  outDir: string;
  /** Files written or that would be written (`dryRun`). */
  files: Array<{
    path: string;
    action: 'write' | 'skip' | 'would-write';
    bytes: number;
  }>;
  errors: string[];
  /** True when nothing was written because of `--dry-run`. */
  dryRun: boolean;
};

/** A styled component the add command may copy. Never primitives. */
export type AddableComponent = {
  /** Closed kebab-case id (matches catalog when present). */
  id: string;
  /** Workspace package name, e.g. `texuli`. */
  package: string;
  /**
   * Directory under the package root that holds the styled source
   * (for example `src/components/button`). Copied recursively.
   */
  directory: string;
  /** Optional peer import hints for the consumer. */
  peers?: readonly string[];
};

export type AddOptions = {
  /** Component id to copy. */
  id: string;
  /** Consumer project root (files land under `outDir`). */
  cwd: string;
  /**
   * Absolute path to the monorepo (or fixture) root that holds
   * `packages/<pkg>/…` source. No network — local paths only.
   */
  sourceRoot: string;
  /**
   * Destination directory relative to `cwd`
   * (default `src/components/texuli/<id>`).
   */
  outDir?: string;
  /** Package version stamped into the provenance header. */
  version?: string;
  /** When true, refuse to overwrite existing files. Default true. */
  force?: boolean;
  /** Plan only; write nothing. */
  dryRun?: boolean;
  /** Override the built-in registry (tests). */
  registry?: readonly AddableComponent[];
};
