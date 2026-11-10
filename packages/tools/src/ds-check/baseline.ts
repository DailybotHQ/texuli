/**
 * Baseline fingerprint of a locked `--report` JSON file: compare later runs
 * without treating the whole document as the snapshot.
 */
import { createHash } from 'node:crypto';

export interface DsFindingKey {
  readonly code: string;
  readonly path: string;
  /** The page route a render finding was found on (0.17.3). */
  readonly route?: string;
  /** The viewport a render finding was found at, `<width>x<height>` (0.17.3). */
  readonly viewport?: string;
  /** The color mode (`light`, `dark`) of the finding (0.17.3). */
  readonly mode?: string;
  /**
   * A host-chosen scope, such as a prototype id, when one run checks several prototypes
   * (0.17.4): the same selector on the same route of two prototypes keys apart.
   */
  readonly scope?: string;
  /** The catalog id of the component the finding is about (0.17.4). */
  readonly component?: string;
}

export interface DsReportCompare {
  /** True when the current report adds no finding keys the baseline did not have. */
  readonly ok: boolean;
  readonly fingerprint: string;
  readonly baseline: string;
  readonly added: readonly DsFindingKey[];
  readonly removed: readonly DsFindingKey[];
}

/** The key fields besides code and path, in key order (new fields are only ever appended). */
const WHERE = ['route', 'viewport', 'mode', 'scope', 'component'] as const;
/** The longest key field read (a hostile report cannot grow the key without bound). */
const MAX_FIELD = 512;
/** The most findings read from one report. */
const MAX_FINDINGS = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const text = (value: unknown): string =>
  typeof value === 'string' ? value.slice(0, MAX_FIELD) : '';

/** A viewport as `<width>x<height>`: a string, or `{ width, height }` in CSS pixels. */
function viewportText(value: unknown): string {
  if (typeof value === 'string') return text(value);
  if (!isRecord(value)) return '';
  const { width, height } = value;
  return Number.isFinite(width) && Number.isFinite(height) ? `${width}x${height}` : '';
}

function keysOf(report: unknown): DsFindingKey[] {
  if (!isRecord(report)) return [];
  const findings = Array.isArray(report.findings) ? report.findings.slice(0, MAX_FINDINGS) : [];
  const keys: DsFindingKey[] = [];
  for (const item of findings) {
    if (!isRecord(item)) continue;
    const code = text(item.code);
    if (!code) continue;
    const route = text(item.route);
    const viewport = viewportText(item.viewport);
    const mode = text(item.mode);
    const scope = text(item.scope);
    const component = text(item.component);
    keys.push({
      code,
      path: text(item.path),
      ...(route ? { route } : {}),
      ...(viewport ? { viewport } : {}),
      ...(mode ? { mode } : {}),
      ...(scope ? { scope } : {}),
      ...(component ? { component } : {}),
    });
  }
  keys.sort((a, b) => keyLine(a).localeCompare(keyLine(b)));
  return keys;
}

/**
 * One key line: `code<TAB>path`, then `route=`, `viewport=`, `mode=`, `scope=` and
 * `component=` for the fields a finding has. A finding with none of them keys exactly as
 * before 0.17.3, so the fingerprint of a report without them is unchanged, and a finding
 * without scope or component keys exactly as in 0.17.3.
 */
function keyLine(item: DsFindingKey): string {
  let line = `${item.code}\t${item.path}`;
  for (const field of WHERE) if (item[field] !== undefined) line += `\t${field}=${item[field]}`;
  return line;
}

/**
 * Whether a baseline key covers a current key: the same code and path, and every route,
 * viewport, mode, scope and component the baseline names is equal. A field the baseline
 * does not name (a baseline saved before 0.17.3 recorded no route or viewport, one saved
 * before 0.17.4 no scope) matches any value, so an older baseline stays readable: it never
 * reports its own findings as added.
 */
function covers(baseline: DsFindingKey, current: DsFindingKey): boolean {
  if (baseline.code !== current.code || baseline.path !== current.path) return false;
  return WHERE.every(
    (field) => baseline[field] === undefined || baseline[field] === current[field]
  );
}

/**
 * Stable SHA-256 of the sorted finding keys: code and path, plus route, viewport, mode,
 * scope and component when the finding has them (0.17.3: findings on different routes,
 * viewports or modes no longer merge into one key; 0.17.4: nor across scopes or components).
 */
export function dsReportFingerprint(report: unknown): string {
  const body = keysOf(report).map(keyLine).join('\n');
  return createHash('sha256').update(body).digest('hex');
}

/**
 * Compare a saved `--locked --report` JSON file to a new report. `ok` is true
 * when nothing new was added (removed findings are improvements). Keys are code, path,
 * route, viewport, mode, scope and component; a field an older baseline does not record
 * matches any value.
 */
export function compareDsReport(baseline: unknown, report: unknown): DsReportCompare {
  const previous = keysOf(baseline);
  const current = keysOf(report);
  const prevSet = new Set(previous.map(keyLine));
  const curSet = new Set(current.map(keyLine));
  // Exact keys first (a set lookup); only the rest are matched field by field.
  const added = current.filter(
    (item) => !prevSet.has(keyLine(item)) && !previous.some((old) => covers(old, item))
  );
  const removed = previous.filter(
    (item) => !curSet.has(keyLine(item)) && !current.some((now) => covers(item, now))
  );
  return {
    ok: added.length === 0,
    fingerprint: dsReportFingerprint(report),
    baseline: dsReportFingerprint(baseline),
    added,
    removed,
  };
}
