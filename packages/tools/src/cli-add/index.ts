/**
 * `@texuli/tools/cli-add` — `texuli add <component>`
 *
 * Copies styled component source into a consumer project with a provenance
 * header. Never copies primitives. Local filesystem only (no network).
 */

export { addComponent, planAdd } from './add.ts';
export { type AddCliArgs, isMainModule, parseAddArgs, runAddCli } from './cli.ts';
export {
  assertNoSymlinkOnPath,
  assertSourceFileInside,
  escapesRoot,
  resolveContainedOutDir,
  resolveContainedSourceDir,
  validateRegistryEntry,
} from './paths.ts';
export {
  hasProvenance,
  isPlainSourcePath,
  type ProvenanceMeta,
  provenanceBlockComment,
  provenanceBody,
  provenanceHeader,
  provenanceHtmlComment,
  provenanceSource,
} from './provenance.ts';
export {
  DEFAULT_ADD_REGISTRY,
  getAddable,
  isPrimitivesPath,
  listAddableIds,
} from './registry.ts';
export type {
  AddableComponent,
  AddFilePlan,
  AddOptions,
  AddResult,
} from './types.ts';
