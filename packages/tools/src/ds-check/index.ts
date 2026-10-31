/**
 * `@texuli/tools/ds-check` (T-ds-conformance): the design-system
 * conformance check behind `texuli ds check`, for adopters' own tests.
 *
 * - {@link checkDesignSystem}: the static checks (validate, `extends`,
 *   compile of the base and its variants, the guarantees re-checked), with
 *   the spec's stable codes and JSON paths. Pure; no browser.
 * - {@link runDsRenderChecks}: the render checks on a Playwright page you
 *   already opened on a sheet that installs `@texuli/tools/ds-check/host`.
 * - {@link renderDesignSystemCheck}: launches chromium and the repository
 *   sheet (or `url`) itself; what `--render` runs.
 */
export { type DsCliArgs, formatDsCheckReport, parseDsCliArgs, runDsCli } from './cli.ts';
export {
  DS_CHECK_AXE_TAGS,
  DS_CHECK_KNOWN_FINDINGS,
  DS_CHECK_SHEET_PATH,
  type DsAxeRunner,
  type DsCheckPage,
  DsCheckRequirementError,
  type DsRenderOptions,
  findSheetApp,
  knownFinding,
  parseKnownFindings,
  playwrightAxeRunner,
  type RenderDesignSystemCheckOptions,
  renderDesignSystemCheck,
  renderIssues,
  runDsRenderChecks,
} from './render.ts';
export {
  checkDesignSystem,
  type DsCheckOptions,
  HIGH_CONTRAST_VARIANT,
  issueCodes,
  serializeDsCheckReport,
} from './static.ts';
export * from './types.ts';
