/**
 * `@texuli/tools` — agent and developer tools.
 * Subpaths land as PLAN_001 tasks ship them.
 */

export {
  type A2uiDiagnostic,
  type A2uiMessage,
  a2uiToCatalogTree,
  catalogTreeToA2ui,
  validateA2uiMessages,
} from './a2ui/index.ts';
export {
  type AddableComponent,
  type AddCliArgs,
  type AddOptions,
  type AddResult,
  addComponent,
  DEFAULT_ADD_REGISTRY,
  getAddable,
  hasProvenance,
  isPrimitivesPath,
  listAddableIds,
  parseAddArgs,
  planAdd,
  provenanceHeader,
  runAddCli,
} from './cli-add/index.ts';
export {
  diffComponent,
  type UpdateFile,
  type UpdateFileStatus,
  type UpdateOptions,
  type UpdateResult,
  updateComponent,
} from './cli-update/index.ts';

export {
  buildLlmsBundle,
  componentDocPath,
  componentHref,
  formatComponentMarkdown,
  formatLlmsFullTxt,
  formatLlmsLink,
  formatLlmsTxt,
  type LlmsBundle,
  type LlmsBundleOptions,
  type LlmsCliArgs,
  type LlmsFile,
  type LlmsWriteResult,
  parseLlmsArgs,
  runLlmsCli,
  writeLlmsBundle,
} from './llms/index.ts';
