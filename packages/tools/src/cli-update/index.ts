/**
 * `@texuli/tools/cli-update` — `texuli diff <component>` and `texuli update <component>`
 *
 * Three-way merge of a copied component (from `texuli add`) against the
 * installed version and the new source. Local filesystem only (no network).
 */

export { parseUpdateArgs, runUpdateCli, type UpdateCliArgs } from './cli.ts';
export {
  type MergeLabels,
  type MergeResult,
  matchLines,
  merge3,
  splitLines,
  unifiedDiff,
} from './lines.ts';
export { type ParsedProvenance, parseProvenance } from './provenance.ts';
export type {
  UpdateFile,
  UpdateFileStatus,
  UpdateOptions,
  UpdateResult,
} from './types.ts';
export { diffComponent, updateComponent } from './update.ts';
