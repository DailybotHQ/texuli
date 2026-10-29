import {
  type ExpressionError,
  type ExpressionScalar,
  expressionError,
  roundHalfAway,
} from '@texuli/core/expression';

/*
 * The closed format set of TEXT (ADR-015): a short list of number, percent
 * and date patterns, matched as whole strings (case-insensitive). There is
 * no format language to parse, so a format can never be slow or surprising.
 * Separators are canonical (`,` for thousands, `.` for decimals); localized
 * display is planned.
 */

/** Every format TEXT accepts. */
export const SHEET_TEXT_FORMATS: readonly string[] = Object.freeze([
  'General',
  '@',
  '0',
  '0.0',
  '0.00',
  '0.000',
  '#,##0',
  '#,##0.0',
  '#,##0.00',
  '0%',
  '0.0%',
  '0.00%',
  'yyyy-mm-dd',
  'dd/mm/yyyy',
  'mm/dd/yyyy',
  'yyyy',
]);

const KNOWN = new Map(SHEET_TEXT_FORMATS.map((format) => [format.toLowerCase(), format]));
const VALUE = expressionError('#VALUE!');
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

function group(digits: string): string {
  let out = '';
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
    out += digits[i];
  }
  return out;
}

function fixed(value: number, decimals: number, thousands: boolean): string | ExpressionError {
  const rounded = roundHalfAway(value, decimals);
  if (rounded === null || Math.abs(rounded) >= 1e21) return expressionError('#NUM!');
  const text = Math.abs(rounded).toFixed(decimals);
  const [whole = '0', fraction] = text.split('.');
  const body = `${thousands ? group(whole) : whole}${fraction === undefined ? '' : `.${fraction}`}`;
  return rounded < 0 ? `-${body}` : body;
}

function general(value: ExpressionScalar): string {
  if (value === null) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return value === 0 ? '0' : String(Number(value.toPrecision(15)));
  return value;
}

/** Format a value with one of `SHEET_TEXT_FORMATS`; `#VALUE!` for another format or a mismatched value. */
export function formatText(value: ExpressionScalar, format: string): string | ExpressionError {
  const known = KNOWN.get(format.trim().toLowerCase());
  if (!known) return VALUE;
  if (known === 'General' || known === '@') return general(value);
  if (known.includes('y')) {
    if (typeof value !== 'string') return VALUE;
    const match = ISO_DAY.exec(value);
    if (!match) return VALUE;
    const [, y, m, d] = match as unknown as [string, string, string, string];
    if (known === 'yyyy') return y;
    if (known === 'yyyy-mm-dd') return `${y}-${m}-${d}`;
    if (known === 'dd/mm/yyyy') return `${d}/${m}/${y}`;
    return `${m}/${d}/${y}`;
  }
  const n = typeof value === 'boolean' ? Number(value) : value === null ? 0 : value;
  if (typeof n !== 'number') return VALUE;
  const percent = known.endsWith('%');
  const pattern = percent ? known.slice(0, -1) : known;
  const decimals = pattern.includes('.') ? pattern.length - pattern.indexOf('.') - 1 : 0;
  const out = fixed(percent ? n * 100 : n, decimals, pattern.startsWith('#,##'));
  return typeof out === 'string' && percent ? `${out}%` : out;
}
