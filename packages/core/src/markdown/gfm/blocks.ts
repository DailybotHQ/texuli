/**
 * GFM block scanners: table rows and delimiter rows (GFM §4.10), footnote definition starts, and
 * task list markers (§5.3). Hand-written loops, linear in the line.
 */
import type { MdAlign } from '../ast.ts';

const isSpaceOrTab = (c: number) => c === 0x20 || c === 0x09;

/**
 * Split a table row into raw cells: an unescaped `|` separates cells (also inside code spans, as
 * GFM specifies), a leading and a trailing pipe are optional, and each cell is trimmed. Escapes
 * stay in the cell (`\|` is resolved by {@link tableCellSource}).
 */
export function splitTableRow(line: string): string[] {
  let start = 0;
  let end = line.length;
  while (start < end && isSpaceOrTab(line.charCodeAt(start))) start++;
  while (end > start && isSpaceOrTab(line.charCodeAt(end - 1))) end--;
  if (line.charCodeAt(start) === 0x7c) start++;
  // A trailing unescaped pipe closes the last cell.
  if (end > start && line.charCodeAt(end - 1) === 0x7c) {
    let backslashes = 0;
    for (let i = end - 2; i >= start && line.charCodeAt(i) === 0x5c; i--) backslashes++;
    if (backslashes % 2 === 0) end--;
  }
  const cells: string[] = [];
  let cell = start;
  for (let i = start; i < end; i++) {
    const c = line.charCodeAt(i);
    if (c === 0x5c) i++;
    else if (c === 0x7c) {
      cells.push(trimCell(line.slice(cell, i)));
      cell = i + 1;
    }
  }
  cells.push(trimCell(line.slice(cell, end)));
  return cells;
}

function trimCell(cell: string): string {
  let start = 0;
  let end = cell.length;
  while (start < end && isSpaceOrTab(cell.charCodeAt(start))) start++;
  while (end > start && isSpaceOrTab(cell.charCodeAt(end - 1))) end--;
  return cell.slice(start, end);
}

/** A cell's inline source: `\|` becomes `|` before inline parsing (GFM §4.10). */
export function tableCellSource(cell: string): string {
  return cell.indexOf('\\|') < 0 ? cell : cell.replace(/\\\|/g, '|');
}

/** The alignments of a delimiter row (`| :-- | :-: | --: |`), or `null` when the line is not one. */
export function parseDelimiterRow(line: string): MdAlign[] | null {
  // A delimiter row holds only pipes, colons, hyphens, spaces and tabs.
  let hyphen = false;
  for (let i = 0; i < line.length; i++) {
    const c = line.charCodeAt(i);
    if (c === 0x2d) hyphen = true;
    else if (c !== 0x7c && c !== 0x3a && !isSpaceOrTab(c)) return null;
  }
  if (!hyphen) return null;
  const align: MdAlign[] = [];
  for (const cell of splitTableRow(line)) {
    if (!/^:?-+:?$/.test(cell)) return null;
    const left = cell.charCodeAt(0) === 0x3a;
    const right = cell.length > 1 && cell.charCodeAt(cell.length - 1) === 0x3a;
    align.push(left && right ? 'center' : left ? 'left' : right ? 'right' : null);
  }
  return align;
}

/**
 * A footnote definition start at `pos` (`[^label]:`, the label without spaces, tabs or `]`),
 * with where its content starts (after the colon and any spaces or tabs), or `null`.
 */
export function footnoteDefinitionStart(
  line: string,
  pos: number
): { readonly label: string; readonly end: number } | null {
  if (line.charCodeAt(pos) !== 0x5b || line.charCodeAt(pos + 1) !== 0x5e) return null;
  let i = pos + 2;
  while (i < line.length && i - pos < 1002) {
    const c = line.charCodeAt(i);
    if (c === 0x5d || c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d || c === 0) break;
    if (c === 0x5c && i + 1 < line.length) i++;
    i++;
  }
  if (i === pos + 2 || line.charCodeAt(i) !== 0x5d || line.charCodeAt(i + 1) !== 0x3a) return null;
  const label = line.slice(pos + 2, i);
  let end = i + 2;
  while (end < line.length && isSpaceOrTab(line.charCodeAt(end))) end++;
  return { label, end };
}

/**
 * A task list marker at the start of a list item's first paragraph (`[ ]`, `[x]` or `[X]`,
 * then whitespace and more text): whether it is checked, and how many characters to drop.
 */
export function taskMarker(
  content: string
): { readonly checked: boolean; readonly length: number } | null {
  if (content.charCodeAt(0) !== 0x5b || content.charCodeAt(2) !== 0x5d) return null;
  const mark = content.charCodeAt(1);
  if (mark !== 0x20 && mark !== 0x09 && mark !== 0x78 && mark !== 0x58) return null;
  let end = 3;
  const after = content.charCodeAt(end);
  if (after !== 0x20 && after !== 0x09 && after !== 0x0a) return null;
  while (end < content.length) {
    const c = content.charCodeAt(end);
    if (c !== 0x20 && c !== 0x09 && c !== 0x0a) break;
    end++;
  }
  if (end >= content.length) return null;
  return { checked: mark === 0x78 || mark === 0x58, length: end };
}
