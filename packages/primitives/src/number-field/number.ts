/**
 * Locale-aware number formatting, parsing and stepping for NumberField
 * (T-prim-number-field). Framework-free. Parsing is the inverse of
 * `Intl.NumberFormat` for the same locale and options: the symbols come from
 * `formatToParts`, so grouping, decimal marks, localized digits, currency
 * and percent follow the locale instead of a hard-coded `1,234.5`.
 */

export type NumberFormatOptions = Intl.NumberFormatOptions;

interface LocaleSymbols {
  group: Set<string>;
  decimal: string;
  /** Localized digit (as written) → its ASCII digit. */
  digits: Map<string, string>;
  /** Currency, percent, unit and literal text the formatter adds. */
  affixes: string[];
  percent: boolean;
}

const symbolCache = new Map<string, LocaleSymbols>();
const formatCache = new Map<string, Intl.NumberFormat>();

function cacheKey(locale: string | undefined, options: NumberFormatOptions | undefined): string {
  return `${locale ?? ''}|${JSON.stringify(options ?? {})}`;
}

/** A cached `Intl.NumberFormat`. */
export function numberFormatter(locale?: string, options?: NumberFormatOptions): Intl.NumberFormat {
  const key = cacheKey(locale, options);
  let formatter = formatCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    formatCache.set(key, formatter);
  }
  return formatter;
}

/** Formats a value; `null` (an empty field) formats as an empty string. */
export function formatNumber(
  value: number | null,
  locale?: string,
  options?: NumberFormatOptions
): string {
  if (value === null || !Number.isFinite(value)) return '';
  return numberFormatter(locale, options).format(value);
}

const SPACES = /[\s\u00a0\u202f]/g;
/** Direction and format marks (ALM, LRM/RLM, embeddings, isolates) that RTL formatting and pasting add. */
const MARKS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;
const MINUS = /^[-\u2212\u2012\u2013\u2014\ufe63\uff0d]/;

function symbolsFor(locale?: string, options?: NumberFormatOptions): LocaleSymbols {
  const key = cacheKey(locale, options);
  const cached = symbolCache.get(key);
  if (cached) return cached;
  const formatter = numberFormatter(locale, options);
  const parts = formatter.formatToParts(-12345.6789);
  const group = new Set<string>();
  let decimal = '.';
  const affixes: string[] = [];
  for (const part of parts) {
    if (part.type === 'group') group.add(part.value.replace(SPACES, ' '));
    else if (part.type === 'decimal') decimal = part.value;
    else if (
      ['currency', 'percentSign', 'unit', 'literal', 'compact', 'exponentSeparator'].includes(
        part.type
      )
    ) {
      const value = part.value.replace(MARKS, '').replace(SPACES, '').trim();
      if (value) affixes.push(value);
    }
  }
  // A space-like group separator is matched as any space.
  if ([...group].some((value) => value.trim() === '')) group.add(' ');
  const digitFormatter = numberFormatter(locale, { useGrouping: false, maximumFractionDigits: 0 });
  const digits = new Map<string, string>();
  for (let digit = 0; digit <= 9; digit += 1) {
    digits.set(digitFormatter.format(digit), String(digit));
    digits.set(String(digit), String(digit));
  }
  const symbols: LocaleSymbols = {
    group,
    decimal,
    digits,
    affixes: affixes.sort((a, b) => b.length - a.length),
    percent: options?.style === 'percent',
  };
  symbolCache.set(key, symbols);
  return symbols;
}

export type ParseResult = { ok: true; value: number | null } | { ok: false };

/**
 * Parses text written for `locale` and `options`. Empty text is `null` (an
 * empty field). Accepts the locale's grouping (optional), its decimal mark,
 * localized digits, a leading minus in any common form, parentheses for
 * accounting negatives, and the formatter's own currency, percent or unit
 * text. Percent style divides by 100, as `Intl` multiplies.
 */
export function parseNumber(
  text: string,
  locale?: string,
  options?: NumberFormatOptions
): ParseResult {
  const symbols = symbolsFor(locale, options);
  let source = text.replace(MARKS, '').replace(SPACES, ' ').trim();
  if (source === '') return { ok: true, value: null };

  let negative = false;
  if (/^\(.*\)$/.test(source)) {
    negative = true;
    source = source.slice(1, -1).trim();
  }
  for (const affix of symbols.affixes) source = source.split(affix).join(' ');
  source = source.trim();
  if (MINUS.test(source)) {
    negative = !negative;
    source = source.slice(1).trim();
  } else if (source.startsWith('+')) {
    source = source.slice(1).trim();
  }
  // A trailing minus (some locales place the sign after the number).
  if (/[-\u2212]$/.test(source)) {
    negative = !negative;
    source = source.slice(0, -1).trim();
  }

  let ascii = '';
  let decimals = 0;
  for (const char of source) {
    const digit = symbols.digits.get(char);
    if (digit !== undefined) ascii += digit;
    else if (char === symbols.decimal) {
      decimals += 1;
      ascii += '.';
    } else if (symbols.group.has(char) || (char === ' ' && symbols.group.has(' '))) {
      if (decimals > 0) return { ok: false };
    } else return { ok: false };
  }
  if (decimals > 1 || ascii === '' || ascii === '.') return { ok: false };
  let value = Number(ascii);
  if (!Number.isFinite(value)) return { ok: false };
  if (symbols.percent) value /= 100;
  return { ok: true, value: negative ? -value : value };
}

/**
 * Whether `text` could still become a number while typing (a lone minus,
 * a trailing decimal mark, a partial group), so a keystroke is not refused
 * just because the text is not complete yet.
 */
export function isPartialNumber(
  text: string,
  locale?: string,
  options?: NumberFormatOptions
): boolean {
  if (parseNumber(text, locale, options).ok) return true;
  const symbols = symbolsFor(locale, options);
  const trimmed = text.replace(MARKS, '').replace(SPACES, ' ').trim();
  if (
    trimmed === '' ||
    trimmed === '+' ||
    trimmed === '(' ||
    (MINUS.test(trimmed) && trimmed.length === 1)
  ) {
    return true;
  }
  // A trailing decimal mark or group separator after digits.
  const last = [...trimmed].at(-1) ?? '';
  if (last === symbols.decimal || symbols.group.has(last)) {
    const head = trimmed.slice(0, -last.length);
    // At most one decimal mark, and none before a trailing group separator.
    if (head.includes(symbols.decimal)) return false;
    return parseNumber(head, locale, options).ok;
  }
  return false;
}

/** Number of decimal places in a finite number (`0.25` → 2, `1e-7` → 7). */
export function decimalPlaces(value: number): number {
  if (!Number.isFinite(value) || Number.isInteger(value)) return 0;
  const text = value.toString();
  const exponent = /e-(\d+)$/.exec(text);
  if (exponent) {
    const mantissa = text.slice(0, text.indexOf('e'));
    return Number(exponent[1]) + (mantissa.split('.')[1]?.length ?? 0);
  }
  return text.split('.')[1]?.length ?? 0;
}

/** Rounds away binary noise to the precision of the given references. */
export function roundToPrecision(value: number, ...references: (number | undefined)[]): number {
  const places = Math.max(
    0,
    ...references.map((reference) => (reference === undefined ? 0 : decimalPlaces(reference)))
  );
  return Number(value.toFixed(Math.min(places, 20)));
}

export function clampNumber(value: number, min?: number, max?: number): number {
  let next = value;
  if (min !== undefined && next < min) next = min;
  if (max !== undefined && next > max) next = max;
  return next;
}

/** The nearest step from `base` (min, or 0): `0.1 + 0.2` snaps to `0.3`, not `0.30000000000000004`. */
export function snapToStep(value: number, step: number, min?: number): number {
  if (!(step > 0)) return value;
  const base = min ?? 0;
  const steps = Math.round((value - base) / step);
  return roundToPrecision(base + steps * step, step, base);
}

export interface StepOptions {
  step: number;
  min?: number;
  max?: number;
}

/**
 * The value after `direction` steps (APG spinbutton): from an empty field,
 * stepping starts at `min` (or 0) clamped into range; otherwise the value
 * moves to the next step on the grid and is clamped to the range.
 */
export function stepNumber(
  value: number | null,
  direction: number,
  { step, min, max }: StepOptions
): number {
  if (value === null) return clampNumber(min ?? 0, min, max);
  const snapped = snapToStep(value, step, min);
  // Off the grid: the first step lands on the grid in that direction.
  const onGrid = Math.abs(snapped - value) < step / 1e9;
  let next: number;
  if (onGrid) next = snapped + direction * step;
  else if (direction > 0) next = snapped > value ? snapped : snapped + step;
  else next = snapped < value ? snapped : snapped - step;
  return clampNumber(roundToPrecision(next, step, min, value), min, max);
}

/**
 * PageUp/PageDown (APG "a larger amount"): move by `largeStep` from the
 * current value, then land on the regular step grid and clamp.
 */
export function largeStepNumber(
  value: number | null,
  direction: number,
  largeStep: number,
  { step, min, max }: StepOptions
): number {
  if (value === null) return clampNumber(min ?? 0, min, max);
  return clampNumber(snapToStep(value + direction * largeStep, step, min), min, max);
}

/** `inputmode` that brings up the right on-screen keyboard. */
export function inputModeFor(
  step: number,
  min?: number,
  options?: NumberFormatOptions
): 'numeric' | 'decimal' {
  const fractions =
    decimalPlaces(step) > 0 ||
    (options?.maximumFractionDigits ?? 0) > 0 ||
    options?.style === 'percent';
  return !fractions && min !== undefined && min >= 0 ? 'numeric' : 'decimal';
}
