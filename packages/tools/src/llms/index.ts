/**
 * `@texuli/tools/llms` — generate `llms.txt`, `llms-full.txt` and per-component
 * Markdown from Texuli catalog manifests (agent docs bundle).
 */

export { buildLlmsBundle } from './bundle.ts';
export {
  isMainModule,
  type LlmsCliArgs,
  parseLlmsArgs,
  runLlmsCli,
} from './cli.ts';
export {
  componentDocPath,
  componentHref,
  formatComponentMarkdown,
  formatLlmsFullTxt,
  formatLlmsLink,
  formatLlmsTxt,
  LLMS_ENVELOPE_NOTES,
} from './format.ts';
export {
  formatSiteLlmsTxt,
  type SiteLlmsLink,
  type SiteLlmsOptions,
  type SiteLlmsSection,
} from './site.ts';
export type {
  LlmsBundle,
  LlmsBundleOptions,
  LlmsFile,
  LlmsWriteResult,
} from './types.ts';
export { writeLlmsBundle } from './write.ts';
