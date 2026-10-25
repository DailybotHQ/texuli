/**
 * Line diffing for `texuli diff` and `texuli update`: Myers' O(ND) diff,
 * a diff3 three-way merge and unified diff output. Plain strings only.
 */

/** Edit distance past which the middle of two files is treated as replaced. */
const MAX_EDITS = 4000;

/** Split text into lines that keep their `\n` (so `\r\n` and a missing final newline survive). */
export function splitLines(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

/**
 * For each line of `a`, the index of the matching line in `b`, or -1.
 * Matches increase monotonically (a longest common subsequence). When the
 * files differ by more than {@link MAX_EDITS} lines, only the common prefix
 * and suffix match.
 */
export function matchLines(a: readonly string[], b: readonly string[]): Int32Array {
  const match = new Int32Array(a.length).fill(-1);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    match[start] = start;
    start += 1;
  }
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
    match[endA] = endB;
  }
  const n = endA - start;
  const m = endB - start;
  if (n === 0 || m === 0) return match;

  const max = Math.min(n + m, MAX_EDITS);
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  let found = false;
  search: for (let d = 0; d <= max; d += 1) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      const down = k === -d || (k !== d && (v[offset + k - 1] ?? 0) < (v[offset + k + 1] ?? 0));
      let x = down ? (v[offset + k + 1] ?? 0) : (v[offset + k - 1] ?? 0) + 1;
      let y = x - k;
      while (x < n && y < m && a[start + x] === b[start + y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = true;
        break search;
      }
    }
  }
  if (!found) return match;

  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0; d -= 1) {
    const prev = trace[d] as Int32Array;
    const k = x - y;
    const down = k === -d || (k !== d && (prev[offset + k - 1] ?? 0) < (prev[offset + k + 1] ?? 0));
    const prevK = down ? k + 1 : k - 1;
    const prevX = prev[offset + prevK] ?? 0;
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      x -= 1;
      y -= 1;
      match[start + x] = start + y;
    }
    x = prevX;
    y = prevY;
  }
  return match;
}

export interface MergeLabels {
  local: string;
  base: string;
  upstream: string;
}

export interface MergeResult {
  text: string;
  /** Conflict regions written with markers (0 for a clean merge). */
  conflicts: number;
}

const sameLines = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((line, i) => line === b[i]);

const withNewline = (lines: readonly string[]) =>
  lines.map((line, i) => (i === lines.length - 1 && !line.endsWith('\n') ? `${line}\n` : line));

/**
 * diff3 three-way merge of `local` and `upstream`, which both started from
 * `base`. A region only one side changed takes that side; a region both
 * changed the same way takes it once; any other region becomes a conflict
 * with `<<<<<<<`, `|||||||`, `=======` and `>>>>>>>` markers.
 */
export function merge3(
  base: string,
  local: string,
  upstream: string,
  labels: MergeLabels
): MergeResult {
  const o = splitLines(base);
  const a = splitLines(local);
  const b = splitLines(upstream);
  const ma = matchLines(o, a);
  const mb = matchLines(o, b);
  const out: string[] = [];
  let conflicts = 0;
  let i = 0;
  let ia = 0;
  let ib = 0;
  while (i < o.length || ia < a.length || ib < b.length) {
    if (i < o.length && ma[i] === ia && mb[i] === ib) {
      out.push(o[i] as string);
      i += 1;
      ia += 1;
      ib += 1;
      continue;
    }
    let k = i;
    while (k < o.length && (ma[k] === -1 || mb[k] === -1)) k += 1;
    const endA = k < o.length ? (ma[k] as number) : a.length;
    const endB = k < o.length ? (mb[k] as number) : b.length;
    const chunkO = o.slice(i, k);
    const chunkA = a.slice(ia, endA);
    const chunkB = b.slice(ib, endB);
    if (sameLines(chunkA, chunkO)) out.push(...chunkB);
    else if (sameLines(chunkB, chunkO) || sameLines(chunkA, chunkB)) out.push(...chunkA);
    else {
      conflicts += 1;
      out.push(
        `<<<<<<< ${labels.local}\n`,
        ...withNewline(chunkA),
        `||||||| ${labels.base}\n`,
        ...withNewline(chunkO),
        '=======\n',
        ...withNewline(chunkB),
        `>>>>>>> ${labels.upstream}\n`
      );
    }
    i = k;
    ia = endA;
    ib = endB;
  }
  return { text: out.join(''), conflicts };
}

/**
 * A unified diff (`---`/`+++` headers and `@@` hunks) from `before` to
 * `after`, or an empty string when they are equal.
 */
export function unifiedDiff(
  before: string,
  after: string,
  names: { from: string; to: string },
  context = 3
): string {
  if (before === after) return '';
  const a = splitLines(before);
  const b = splitLines(after);
  const match = matchLines(a, b);
  const ops: Array<{ op: ' ' | '-' | '+'; line: string }> = [];
  let j = 0;
  for (let i = 0; i < a.length; i += 1) {
    const target = match[i] as number;
    if (target === -1) {
      ops.push({ op: '-', line: a[i] as string });
      continue;
    }
    for (; j < target; j += 1) ops.push({ op: '+', line: b[j] as string });
    ops.push({ op: ' ', line: a[i] as string });
    j += 1;
  }
  for (; j < b.length; j += 1) ops.push({ op: '+', line: b[j] as string });

  // Hunks: every change with `context` lines around it, overlapping ranges joined.
  const ranges: Array<{ start: number; end: number }> = [];
  ops.forEach((entry, index) => {
    if (entry.op === ' ') return;
    const start = Math.max(0, index - context);
    const end = Math.min(ops.length, index + context + 1);
    const last = ranges[ranges.length - 1];
    if (last && start <= last.end) last.end = Math.max(last.end, end);
    else ranges.push({ start, end });
  });

  const out = [`--- ${names.from}\n`, `+++ ${names.to}\n`];
  let cursor = 0;
  let oldLine = 0;
  let newLine = 0;
  for (const range of ranges) {
    for (; cursor < range.start; cursor += 1) {
      if (ops[cursor]?.op !== '+') oldLine += 1;
      if (ops[cursor]?.op !== '-') newLine += 1;
    }
    const hunk = ops.slice(range.start, range.end);
    const oldCount = hunk.filter((h) => h.op !== '+').length;
    const newCount = hunk.filter((h) => h.op !== '-').length;
    const oldStart = oldCount === 0 ? oldLine : oldLine + 1;
    const newStart = newCount === 0 ? newLine : newLine + 1;
    out.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@\n`);
    for (const h of hunk) {
      out.push(`${h.op}${h.line}`);
      if (!h.line.endsWith('\n')) out.push('\n\\ No newline at end of file\n');
    }
  }
  return out.join('');
}
