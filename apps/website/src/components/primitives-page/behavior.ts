/**
 * Behavior evidence for the primitives reference, read from the committed
 * behavior suite at build time: each scenario's rows (or standalone checks)
 * and the suite's absolute limits. Nothing is fetched or run when the page
 * is served.
 */

/** One row of a scenario (`defineRows`). */
export interface BehaviorRow {
  id: string;
  title: string;
}

export interface BehaviorEvidence {
  /** Scenario name (the primitive id). */
  scenario: string;
  /** Repository path of the spec. */
  file: string;
  /**
   * `rows`: a `defineRows` scenario.
   * `checks`: standalone browser tests.
   * `missing`: no scenario file.
   */
  kind: 'rows' | 'checks' | 'missing';
  rows: BehaviorRow[];
  /** Test titles of a standalone spec. */
  checks: string[];
}

/** Reads one string literal, or `'a' + 'b'` concatenations, starting at `from`. */
function readString(text: string, from: number): string | undefined {
  const literal = /\s*(['"`])((?:\\.|(?!\1)[\s\S])*)\1\s*/y;
  const parts: string[] = [];
  let at = from;
  for (;;) {
    literal.lastIndex = at;
    const match = literal.exec(text);
    if (!match) break;
    parts.push((match[2] ?? '').replace(/\\(['"`\\])/g, '$1'));
    at = literal.lastIndex;
    if (text[at] !== '+') break;
    at += 1;
  }
  return parts.length > 0 ? parts.join('') : undefined;
}

/** The rows of a `defineRows([...])` scenario, in order. */
export function parseBehaviorRows(source: string): BehaviorRow[] {
  const heads = [...source.matchAll(/\bid:\s*(['"])((?:\\.|(?!\1).)*)\1\s*,\s*title:/g)];
  return heads.map((head) => ({
    id: (head[2] ?? '').replace(/\\(['"])/g, '$1'),
    title: readString(source, (head.index ?? 0) + head[0].length) ?? '',
  }));
}

/** The `test('…')` titles of a standalone spec. */
export function parseBehaviorChecks(source: string): string[] {
  return [...source.matchAll(/\btest\(/g)]
    .map((match) => readString(source, (match.index ?? 0) + match[0].length))
    .filter((title): title is string => Boolean(title));
}

/** The open-to-focus limits from the suite's `limits.ts`: default and per primitive (ms). */
export function parseOpenToFocusLimits(limitsSource: string): {
  defaultMs?: number;
  byPrimitive: Record<string, number>;
} {
  const fallback = /DEFAULT_OPEN_TO_FOCUS_P75_MS\s*=\s*([0-9]+)/.exec(limitsSource)?.[1];
  const block = /OPEN_TO_FOCUS_P75_MS:[^=]*=\s*\{([\s\S]*?)\}/.exec(limitsSource)?.[1] ?? '';
  const byPrimitive: Record<string, number> = {};
  for (const match of block.matchAll(/['"]?([a-z0-9-]+)['"]?:\s*([0-9]+)/g)) {
    byPrimitive[match[1] as string] = Number(match[2]);
  }
  return { ...(fallback ? { defaultMs: Number(fallback) } : {}), byPrimitive };
}

/** Classifies a scenario source and extracts its evidence. */
export function behaviorEvidence(scenario: string, source: string | undefined): BehaviorEvidence {
  const file = `tests/behavior/scenarios/${scenario}.spec.ts`;
  if (source === undefined) return { scenario, file, kind: 'missing', rows: [], checks: [] };
  if (/\bdefineRows\s*\(/.test(source)) {
    return { scenario, file, kind: 'rows', rows: parseBehaviorRows(source), checks: [] };
  }
  return { scenario, file, kind: 'checks', rows: [], checks: parseBehaviorChecks(source) };
}
