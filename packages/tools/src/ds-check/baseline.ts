/**
 * Baseline fingerprint of a locked `--report` JSON file: compare later runs
 * without treating the whole document as the snapshot.
 */
import { createHash } from 'node:crypto';

export interface DsFindingKey {
  readonly code: string;
  readonly path: string;
}

export interface DsReportCompare {
  /** True when the current report adds no finding keys the baseline did not have. */
  readonly ok: boolean;
  readonly fingerprint: string;
  readonly baseline: string;
  readonly added: readonly DsFindingKey[];
  readonly removed: readonly DsFindingKey[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function keysOf(report: unknown): DsFindingKey[] {
  if (!isRecord(report)) return [];
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const keys: DsFindingKey[] = [];
  for (const item of findings) {
    if (!isRecord(item)) continue;
    const code = typeof item.code === 'string' ? item.code : '';
    const path = typeof item.path === 'string' ? item.path : '';
    if (code) keys.push({ code, path });
  }
  keys.sort((a, b) => a.code.localeCompare(b.code) || a.path.localeCompare(b.path));
  return keys;
}

function keyLine(item: DsFindingKey): string {
  return `${item.code}\t${item.path}`;
}

/** Stable SHA-256 of sorted finding `code` + `path` pairs. */
export function dsReportFingerprint(report: unknown): string {
  const body = keysOf(report).map(keyLine).join('\n');
  return createHash('sha256').update(body).digest('hex');
}

/**
 * Compare a saved `--locked --report` JSON file to a new report. `ok` is true
 * when nothing new was added (removed findings are improvements).
 */
export function compareDsReport(baseline: unknown, report: unknown): DsReportCompare {
  const previous = keysOf(baseline);
  const current = keysOf(report);
  const prevSet = new Set(previous.map(keyLine));
  const curSet = new Set(current.map(keyLine));
  const added = current.filter((item) => !prevSet.has(keyLine(item)));
  const removed = previous.filter((item) => !curSet.has(keyLine(item)));
  return {
    ok: added.length === 0,
    fingerprint: dsReportFingerprint(report),
    baseline: dsReportFingerprint(baseline),
    added,
    removed,
  };
}
