import {
  clearLibraryThemeCache,
  loadLibraryTheme,
  THEME_LIBRARY_META,
} from '../library-port/registry.ts';
import { createHighContrastPalette } from '../modes/modes.ts';
import {
  type AaGateReport,
  type AaGateThemeReport,
  aggregateAaGateReports,
  runAaGateOnTheme,
} from './report.ts';

export interface RunLibraryAaGateOptions {
  /** When true (default), also evaluate the system-color high-contrast palette. */
  includeHighContrast?: boolean;
  /** Clear the library theme cache before loading (default true in tests). */
  clearCache?: boolean;
  /** Limit to these theme ids (default: every catalog entry). */
  themeIds?: readonly string[];
}

/**
 * Run the AA gate on every (or selected) library theme in light and dark.
 * Optionally includes the shared high-contrast system palette once per theme
 * so website pages can show skipped non-hex pairs under forced colors.
 *
 * Results are plain data: feed them to theme gallery pages without re-running
 * contrast math in the browser.
 */
export async function runLibraryAaGate(
  options: RunLibraryAaGateOptions = {}
): Promise<AaGateReport> {
  if (options.clearCache !== false) clearLibraryThemeCache();

  const includeHighContrast = options.includeHighContrast !== false;
  const highContrast = includeHighContrast ? createHighContrastPalette() : undefined;

  const metas = options.themeIds
    ? THEME_LIBRARY_META.filter((meta) => options.themeIds?.includes(meta.id))
    : THEME_LIBRARY_META;

  const themes: AaGateThemeReport[] = [];
  for (const meta of metas) {
    const theme = await loadLibraryTheme(meta.id);
    themes.push(
      runAaGateOnTheme({
        id: theme.id,
        name: theme.name,
        contrastLevel: meta.contrastLevel,
        light: theme.light,
        dark: theme.dark,
        ...(highContrast ? { highContrast } : {}),
      })
    );
  }
  return aggregateAaGateReports(themes);
}

/**
 * Compact JSON for website build steps. Omits per-pair rows that passed so
 * pages can list failures first without shipping the full matrix.
 */
export function aaGateReportForWebsite(report: AaGateReport): {
  pass: boolean;
  themeCount: number;
  issueCount: number;
  textMinimumDefault: number;
  uiMinimum: number;
  themes: {
    themeId: string;
    themeName: string;
    contrastLevel: string;
    pass: boolean;
    issueCount: number;
    enhancedIssueCount: number;
    enhancedIssues: AaGateThemeReport['enhancedIssues'];
    modes: {
      mode: string;
      pass: boolean;
      issueCount: number;
      issues: AaGateThemeReport['modes'][number]['issues'];
    }[];
  }[];
} {
  return {
    pass: report.pass,
    themeCount: report.themeCount,
    issueCount: report.issueCount,
    textMinimumDefault: report.textMinimumDefault,
    uiMinimum: report.uiMinimum,
    themes: report.themes.map((theme) => ({
      themeId: theme.themeId,
      themeName: theme.themeName,
      contrastLevel: theme.contrastLevel,
      pass: theme.pass,
      issueCount: theme.issueCount,
      enhancedIssueCount: theme.enhancedIssueCount,
      enhancedIssues: theme.enhancedIssues,
      modes: theme.modes.map((mode) => ({
        mode: mode.mode,
        pass: mode.pass,
        issueCount: mode.issueCount,
        issues: mode.issues,
      })),
    })),
  };
}
