import type { SemanticPalette } from '../contract/semantic.ts';
import type { Theme } from '../contract/types.ts';
import {
  type ContrastIssue,
  checkPaletteContrast,
  THEME_CONTRAST_PAIRS,
} from '../generator/contrast.ts';
import { contrastRatio, parseHex } from '../palette/contrast.ts';
import {
  AA_TEXT_MINIMUM,
  AA_UI_MINIMUM,
  type AaContrastLevel,
  contrastPairId,
  textMinimumForLevel,
} from './pairs.ts';

/** One mode the gate evaluates on a theme. */
export type AaGateMode = 'light' | 'dark' | 'high-contrast';

/** One pair evaluation — serializable for website theme pages. */
export interface AaGatePairResult {
  pairId: string;
  kind: 'text' | 'ui';
  foreground: string;
  background: string;
  state: 'default' | 'hover' | 'active';
  ratio: number | null;
  required: number;
  /** True when the pair meets its floor (or was skipped as non-hex). */
  pass: boolean;
  /** Non-hex colors (system keywords, translucent) are outside WCAG hex math. */
  skipped?: 'non-hex';
}

export interface AaGateModeReport {
  mode: AaGateMode;
  pairCount: number;
  checkedCount: number;
  skippedCount: number;
  issueCount: number;
  pass: boolean;
  pairs: AaGatePairResult[];
  issues: AaGatePairResult[];
}

export interface AaGateThemeReport {
  themeId: string;
  themeName: string;
  /** Declared catalog level (AA or AAA). Pass/fail always uses AA floors. */
  contrastLevel: AaContrastLevel;
  /** Floor used for pass/fail (always AA text minimum). */
  textMinimum: number;
  uiMinimum: number;
  /** When the theme declares AAA, pairs below 7:1 (defaults only) are listed here. */
  enhancedTextMinimum: number | null;
  enhancedIssueCount: number;
  enhancedIssues: AaGatePairResult[];
  modes: AaGateModeReport[];
  issueCount: number;
  pass: boolean;
}

export interface AaGateReport {
  textMinimumDefault: number;
  uiMinimum: number;
  themeCount: number;
  issueCount: number;
  pass: boolean;
  themes: AaGateThemeReport[];
}

export interface AaGateThemeInput {
  id: string;
  name: string;
  contrastLevel?: AaContrastLevel;
  light: SemanticPalette;
  dark: SemanticPalette;
  /** Optional high-contrast palette (system colors are skipped as non-hex). */
  highContrast?: SemanticPalette;
}

function issueToPairResult(issue: ContrastIssue): AaGatePairResult {
  const pair = THEME_CONTRAST_PAIRS.find(
    (candidate) =>
      candidate.foreground === issue.foreground && candidate.background === issue.background
  );
  return {
    pairId: pair ? contrastPairId(pair) : `text:${issue.foreground}/${issue.background}`,
    kind: pair?.kind ?? 'text',
    foreground: issue.foreground,
    background: issue.background,
    state: issue.state,
    ratio: issue.ratio,
    required: issue.required,
    pass: false,
  };
}

/**
 * Expand every guaranteed pair for one palette into website-ready rows.
 * Non-hex values are marked skipped (not failures).
 */
export function evaluatePalettePairs(
  palette: SemanticPalette,
  options: { textMinimum?: number; uiMinimum?: number } = {}
): AaGatePairResult[] {
  const textMinimum = options.textMinimum ?? AA_TEXT_MINIMUM;
  const uiMinimum = options.uiMinimum ?? AA_UI_MINIMUM;
  const rows: AaGatePairResult[] = [];

  for (const pair of THEME_CONTRAST_PAIRS) {
    const foreground = palette[pair.foreground].default;
    const background = palette[pair.background];
    const required = pair.kind === 'text' ? textMinimum : uiMinimum;
    const states = pair.states ? (['default', 'hover', 'active'] as const) : (['default'] as const);

    for (const state of states) {
      const color = background[state];
      const pairId = contrastPairId(pair);
      if (!color || !parseHex(foreground) || !parseHex(color)) {
        rows.push({
          pairId,
          kind: pair.kind,
          foreground: pair.foreground,
          background: pair.background,
          state,
          ratio: null,
          required,
          pass: true,
          skipped: 'non-hex',
        });
        continue;
      }
      const ratio = contrastRatio(foreground, color);
      rows.push({
        pairId,
        kind: pair.kind,
        foreground: pair.foreground,
        background: pair.background,
        state,
        ratio,
        required,
        pass: ratio >= required,
      });
    }
  }
  return rows;
}

function modeReport(
  mode: AaGateMode,
  palette: SemanticPalette,
  textMinimum: number,
  uiMinimum: number
): AaGateModeReport {
  const pairs = evaluatePalettePairs(palette, { textMinimum, uiMinimum });
  const checkerIssues = checkPaletteContrast(palette, { textMinimum }).map(issueToPairResult);
  // Prefer the shared checker’s issue list so the gate and generator stay aligned.
  const issues =
    checkerIssues.length > 0 ? checkerIssues : pairs.filter((row) => !row.pass && !row.skipped);
  const skippedCount = pairs.filter((row) => row.skipped).length;
  return {
    mode,
    pairCount: pairs.length,
    checkedCount: pairs.length - skippedCount,
    skippedCount,
    issueCount: issues.length,
    pass: issues.length === 0,
    pairs,
    issues,
  };
}

/**
 * Evaluate one theme (light, dark, optional high-contrast).
 * Pass/fail uses WCAG 2.x **AA** floors (4.5:1 text, 3:1 UI), including
 * interactive hover/active states. When the theme declares AAA, default-state
 * text pairs below 7:1 are reported as `enhancedIssues` without failing the gate
 * (AAA hover fills are often softer than 7:1 by design).
 */
export function runAaGateOnTheme(theme: AaGateThemeInput): AaGateThemeReport {
  const contrastLevel: AaContrastLevel = theme.contrastLevel === 'AAA' ? 'AAA' : 'AA';
  const textMinimum = AA_TEXT_MINIMUM;
  const uiMinimum = AA_UI_MINIMUM;

  const modes: AaGateModeReport[] = [
    modeReport('light', theme.light, textMinimum, uiMinimum),
    modeReport('dark', theme.dark, textMinimum, uiMinimum),
  ];
  if (theme.highContrast) {
    modes.push(modeReport('high-contrast', theme.highContrast, textMinimum, uiMinimum));
  }

  const enhancedIssues: AaGatePairResult[] = [];
  let enhancedTextMinimum: number | null = null;
  if (contrastLevel === 'AAA') {
    enhancedTextMinimum = textMinimumForLevel('AAA');
    for (const { mode, palette } of [
      { mode: 'light' as const, palette: theme.light },
      { mode: 'dark' as const, palette: theme.dark },
    ]) {
      for (const issue of checkPaletteContrast(palette, { textMinimum: enhancedTextMinimum })) {
        // Enhanced diagnostics: default state only (hover/active stay on AA).
        if (issue.state !== 'default') continue;
        enhancedIssues.push({
          ...issueToPairResult(issue),
          pairId: `${issueToPairResult(issue).pairId}@${mode}`,
        });
      }
    }
  }

  const issueCount = modes.reduce((sum, entry) => sum + entry.issueCount, 0);
  return {
    themeId: theme.id,
    themeName: theme.name,
    contrastLevel,
    textMinimum,
    uiMinimum,
    enhancedTextMinimum,
    enhancedIssueCount: enhancedIssues.length,
    enhancedIssues,
    modes,
    issueCount,
    pass: issueCount === 0,
  };
}

/** Gate a contract `Theme` (light + dark only). */
export function runAaGateOnContractTheme(
  theme: Theme,
  options: { contrastLevel?: AaContrastLevel } = {}
): AaGateThemeReport {
  return runAaGateOnTheme({
    id: theme.id,
    name: theme.name,
    contrastLevel: options.contrastLevel,
    light: theme.light,
    dark: theme.dark,
  });
}

/** Aggregate many theme reports into one library-level report. */
export function aggregateAaGateReports(themes: readonly AaGateThemeReport[]): AaGateReport {
  const issueCount = themes.reduce((sum, theme) => sum + theme.issueCount, 0);
  return {
    textMinimumDefault: AA_TEXT_MINIMUM,
    uiMinimum: AA_UI_MINIMUM,
    themeCount: themes.length,
    issueCount,
    pass: issueCount === 0,
    themes: [...themes],
  };
}
