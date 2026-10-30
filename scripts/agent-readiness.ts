/**
 * Pure evaluation of an isitagentready.com scan (PLAN_011 T-ar-score): which
 * checks block "every non-commerce check passes". Informational checks may
 * stay `neutral`; commerce checks are never required (texuli.com sells
 * nothing). `allow` names checks a caller accepts as failing, each with a
 * reason, e.g. checks that compare against texuli.com while a preview is
 * scanned.
 */

export interface ScanCheck {
  status?: string;
  message?: string;
}

export interface ScanResult {
  url?: string;
  level?: number;
  levelName?: string;
  checks?: Record<string, Record<string, ScanCheck>>;
}

export interface ScanRow {
  category: string;
  check: string;
  status: string;
  message: string;
  allowed: boolean;
}

/** Categories whose checks are never required of a site that sells nothing. */
export const OPTIONAL_CATEGORIES: ReadonlySet<string> = new Set(['commerce']);

/** Flatten a scan into rows, marking the checks the caller allowed to fail. */
export function scanRows(scan: ScanResult, allow: ReadonlySet<string>): ScanRow[] {
  const rows: ScanRow[] = [];
  for (const [category, checks] of Object.entries(scan.checks ?? {})) {
    for (const [check, result] of Object.entries(checks)) {
      rows.push({
        category,
        check,
        status: result.status ?? 'unknown',
        message: result.message ?? '',
        allowed: allow.has(check),
      });
    }
  }
  return rows;
}

/** The rows that keep "every non-commerce check passes" from holding. */
export function blockingRows(rows: readonly ScanRow[]): ScanRow[] {
  return rows.filter(
    (row) =>
      !OPTIONAL_CATEGORIES.has(row.category) &&
      row.status !== 'pass' &&
      row.status !== 'neutral' &&
      !row.allowed
  );
}
