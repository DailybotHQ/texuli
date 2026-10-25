/**
 * WCAG 2.x AA gate for every theme and mode.
 * APCA is out of scope (license); only WCAG contrast ratios are used.
 *
 * Component chrome pairs (Button, Badge, map markers, …) live on
 * `@texuli/tokens/aa-gate/components` so this entry stays a light checking tool.
 */

export {
  aaGateReportForWebsite,
  type RunLibraryAaGateOptions,
  runLibraryAaGate,
} from './library.ts';
export {
  AA_TEXT_MINIMUM,
  AA_UI_MINIMUM,
  AAA_TEXT_MINIMUM,
  type AaContrastLevel,
  type ContrastPair,
  contrastPairId,
  gatedSemanticRoles,
  THEME_CONTRAST_PAIRS,
  textMinimumForLevel,
} from './pairs.ts';
export {
  type AaGateMode,
  type AaGateModeReport,
  type AaGatePairResult,
  type AaGateReport,
  type AaGateThemeInput,
  type AaGateThemeReport,
  aggregateAaGateReports,
  evaluatePalettePairs,
  runAaGateOnContractTheme,
  runAaGateOnTheme,
} from './report.ts';
