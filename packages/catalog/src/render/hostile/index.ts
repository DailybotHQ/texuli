/**
 * `@texuli/catalog/render/hostile` — hostile corpus for the sink-free renderer.
 *
 * Script URLs, fake dialogs, bidi tricks, giant trees, prompt-injection text:
 * every sample must render **inert** (no executable URLs, no class/style, no
 * HTML sinks). Browser e2e asserts zero script execution.
 */

export {
  assertInertRoots,
  collectRenderStrings,
  hardenInertRoots,
  looksExecutable,
  runHostileCorpus,
  runHostileSample,
} from './run.ts';
export { HOSTILE_SAMPLES, hostileSamplesJson } from './samples.ts';
export type {
  HostileCategory,
  HostileCorpusOptions,
  HostileCorpusReport,
  HostileRunResult,
  HostileSample,
} from './types.ts';
