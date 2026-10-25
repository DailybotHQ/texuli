/**
 * Framework-free TSV clipboard helpers for grid cells.
 * Spreadsheet paste uses tab between columns and newline between rows.
 */

/** Serialize a rectangular block of cell strings to TSV. */
export function serializeClipboard(rows: readonly (readonly string[])[]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = cell ?? '';
          if (/[\t\n\r"]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
          return text;
        })
        .join('\t')
    )
    .join('\n');
}

/**
 * Parse a TSV/CSV-ish clipboard payload into a 2D string grid.
 * Quoted fields may contain tabs and newlines. A trailing newline does not
 * add an empty row.
 */
export function parseClipboard(text: string): string[][] {
  const source = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  if (source.length === 0) return [['']];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < source.length) {
    const ch = source[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === '\t') {
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  // Trailing content without a final newline.
  if (field.length > 0 || row.length > 0 || rows.length === 0) {
    pushRow();
  }

  // Drop a lone empty row produced only by a terminal newline.
  if (
    rows.length > 1 &&
    rows[rows.length - 1]?.length === 1 &&
    rows[rows.length - 1]?.[0] === '' &&
    source.endsWith('\n')
  ) {
    rows.pop();
  }

  return rows.length === 0 ? [['']] : rows;
}

export interface ClipboardPastePlan {
  rowOffset: number;
  colOffset: number;
  value: string;
}

/** Expand a pasted block into offsets from the top-left anchor cell. */
export function pastePlan(block: readonly (readonly string[])[]): ClipboardPastePlan[] {
  const plans: ClipboardPastePlan[] = [];
  for (let r = 0; r < block.length; r += 1) {
    const line = block[r] ?? [];
    for (let c = 0; c < line.length; c += 1) {
      plans.push({ rowOffset: r, colOffset: c, value: line[c] ?? '' });
    }
  }
  return plans;
}
