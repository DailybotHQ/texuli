/**
 * CSP violation report intake (Task 82). texuli.com sends every page a
 * `Content-Security-Policy-Report-Only` header next to the enforcing one;
 * when a build binds a report endpoint, browsers POST violation reports here.
 *
 * Reports are untrusted input from any visitor's browser, so they are
 * reduced to a few low-cardinality fields before anything is kept: the
 * directive, what was blocked (a keyword or a bare origin, never a path or
 * query), the page path (no query or fragment), and the disposition. No
 * script samples, no full URLs, no user agent and no IP are stored. Counts
 * and the last few records live in memory per worker instance.
 */

export const CSP_REPORT_TYPES = [
  'application/reports+json',
  'application/csp-report',
  'application/json',
] as const;
/** Largest report body read; larger bodies are refused without buffering. */
export const MAX_CSP_REPORT_BYTES = 16 * 1024;
/** Most reports read from one body (the Reporting API batches them). */
export const MAX_REPORTS_PER_BODY = 20;

export interface CspViolation {
  /** Effective directive, e.g. `style-src-elem`; `other` when unrecognizable. */
  directive: string;
  /** `inline`, `eval`, `wasm-eval`, `trusted-types-sink`, `trusted-types-policy`, `data`, `blob`, a bare origin, or `other`. */
  blocked: string;
  /** Path of the page that reported, without query or fragment; `/` when unknown. */
  page: string;
  disposition: 'enforce' | 'report';
}

const DIRECTIVE = /^[a-z][a-z-]{1,40}$/;
const KEYWORDS = new Set([
  'inline',
  'eval',
  'wasm-eval',
  'trusted-types-sink',
  'trusted-types-policy',
  'data',
  'blob',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function directiveOf(body: Record<string, unknown>): string {
  const raw =
    text(body.effectiveDirective) ||
    text(body['effective-directive']) ||
    text(body.violatedDirective) ||
    text(body['violated-directive']);
  const first = raw.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return DIRECTIVE.test(first) ? first : 'other';
}

function blockedOf(body: Record<string, unknown>): string {
  const raw = (text(body.blockedURL) || text(body['blocked-uri'])).trim().toLowerCase();
  if (KEYWORDS.has(raw)) return raw;
  if (raw.startsWith('data:')) return 'data';
  if (raw.startsWith('blob:')) return 'blob';
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin;
  } catch {
    // Not a URL: fall through.
  }
  return 'other';
}

function pageOf(body: Record<string, unknown>, fallback: string): string {
  const raw = text(body.documentURL) || text(body['document-uri']) || fallback;
  try {
    const path = new URL(raw).pathname;
    return /^\/[\w\-./~%]{0,199}$/.test(path) ? path : '/';
  } catch {
    return '/';
  }
}

function violationOf(body: Record<string, unknown>, url = ''): CspViolation {
  const disposition = text(body.disposition) === 'enforce' ? 'enforce' : 'report';
  return {
    directive: directiveOf(body),
    blocked: blockedOf(body),
    page: pageOf(body, url),
    disposition,
  };
}

export type CspReportParse =
  | { ok: true; violations: CspViolation[]; skipped: number }
  | { ok: false; reason: 'unsupported-type' | 'malformed' };

/**
 * Parse one report body: the Reporting API (`application/reports+json`, an
 * array of `{ type: 'csp-violation', url, body }`) or the legacy
 * `report-uri` shape (`application/csp-report`, `{ "csp-report": {…} }`).
 */
export function parseCspReports(contentType: string | null, raw: string): CspReportParse {
  const type = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (!(CSP_REPORT_TYPES as readonly string[]).includes(type)) {
    return { ok: false, reason: 'unsupported-type' };
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (Array.isArray(value)) {
    const violations: CspViolation[] = [];
    let skipped = 0;
    for (const [index, item] of value.entries()) {
      const report = asRecord(item);
      const body = asRecord(report?.body);
      if (index >= MAX_REPORTS_PER_BODY || report?.type !== 'csp-violation' || !body) {
        skipped += 1;
        continue;
      }
      violations.push(violationOf(body, text(report.url)));
    }
    return { ok: true, violations, skipped };
  }
  const legacy = asRecord(asRecord(value)?.['csp-report']);
  if (!legacy) return { ok: false, reason: 'malformed' };
  return { ok: true, violations: [violationOf(legacy)], skipped: 0 };
}

export interface CspReportSnapshot {
  accepted: number;
  /** Bodies refused (wrong type, malformed, too large) plus reports skipped inside bodies. */
  dropped: number;
  /** Counts per `directive blocked` key; at most `maxKeys` keys, the rest counted under `other`. */
  byViolation: Readonly<Record<string, number>>;
  /** The most recent reduced violations, newest last. */
  recent: readonly CspViolation[];
}

export interface CspReportStore {
  record(violation: CspViolation): void;
  drop(count?: number): void;
  snapshot(): CspReportSnapshot;
}

/** An in-memory store with bounded keys and history, per worker instance. */
export function createCspReportStore(
  options: { maxKeys?: number; recent?: number } = {}
): CspReportStore {
  const maxKeys = options.maxKeys ?? 64;
  const keep = options.recent ?? 20;
  const counts = new Map<string, number>();
  const recent: CspViolation[] = [];
  let accepted = 0;
  let dropped = 0;
  return {
    record(violation) {
      accepted += 1;
      let key = `${violation.directive} ${violation.blocked}`;
      if (!counts.has(key) && counts.size >= maxKeys) key = 'other';
      counts.set(key, (counts.get(key) ?? 0) + 1);
      recent.push(violation);
      if (recent.length > keep) recent.shift();
    },
    drop(count = 1) {
      dropped += count;
    },
    snapshot() {
      return {
        accepted,
        dropped,
        byViolation: Object.fromEntries([...counts].sort(([a], [b]) => (a < b ? -1 : 1))),
        recent: [...recent],
      };
    },
  };
}

async function readBounded(request: Request, limit: number): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Handle `POST /v1/csp-reports`: 204 for any accepted body (browsers ignore
 * the answer), 413 when too large, 415 for another content type, 400 when
 * malformed. Never echoes the report back.
 */
export async function handleCspReport(request: Request, store: CspReportStore): Promise<Response> {
  const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  const raw = await readBounded(request, MAX_CSP_REPORT_BYTES);
  if (raw === null) {
    store.drop();
    return new Response(null, { status: 413, headers });
  }
  const parsed = parseCspReports(request.headers.get('content-type'), raw);
  if (!parsed.ok) {
    store.drop();
    return new Response(null, {
      status: parsed.reason === 'unsupported-type' ? 415 : 400,
      headers,
    });
  }
  for (const violation of parsed.violations) store.record(violation);
  if (parsed.skipped) store.drop(parsed.skipped);
  return new Response(null, { status: 204, headers });
}
