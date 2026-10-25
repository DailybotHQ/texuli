/**
 * `texuli init` and `texuli theme` (`@texuli/tools/cli-init`): wire tokens
 * and CSS into Vite, Astro and SvelteKit projects; list, preview and apply
 * themes. Node only, no network.
 */
export { type InitCliArgs, parseInitArgs, runInitCli, USAGE } from './cli.ts';
export { CONFIG_FILE, formatConfig, parseConfig } from './config.ts';
export { DEFAULTS, detectFramework, FRAMEWORKS } from './detect.ts';
export { DEFAULT_NAMESPACE, DEFAULT_THEME, initProject } from './init.ts';
export { projectPathError } from './safe-path.ts';
export { applyProjectTheme } from './theme-apply.ts';
export {
  listThemes,
  PREVIEW_TOKENS,
  previewTheme,
  type ThemePreview,
  type ThemeSummary,
} from './themes.ts';
export type {
  CommandResult,
  FileChange,
  Framework,
  InitOptions,
  InitResult,
  TexuliConfig,
  ThemeApplyOptions,
} from './types.ts';
export {
  CSS_HEADER,
  documentTheme,
  importSpecifier,
  isGeneratedStylesheet,
  stylesheet,
  withCssImport,
  withDocumentWiring,
  withTheme,
} from './wire.ts';
