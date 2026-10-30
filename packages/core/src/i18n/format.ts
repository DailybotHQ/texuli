/**
 * Message formatting for `@texuli/core/i18n` (ADR-016): `{name}`
 * placeholders, and plural or select objects resolved through
 * `Intl.PluralRules`. One left-to-right pass, no recursion: a substituted
 * value is never scanned again, so a value that contains `{name}` stays
 * literal text. Output is always a string (text, never markup).
 */

/** A plural message: `#` in a case is the formatted count. `=0`, `=1`… match exact counts first. */
export interface PluralMessage {
  readonly plural: string;
  readonly other: string;
  readonly zero?: string;
  readonly one?: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
  readonly [exact: `=${number}`]: string | undefined;
}

/** A select message: the case named by the value of `select`, else `other`. */
export interface SelectMessage {
  readonly select: string;
  readonly other: string;
  readonly [value: string]: string;
}

/** A message: a string with `{name}` placeholders, or a plural or select object of such strings. */
export type Message = string | PluralMessage | SelectMessage;

/** Values a message substitutes. Strings are inserted as is; numbers are formatted for the locale. */
export type MessageValues = Readonly<Record<string, string | number>>;

/** A placeholder name: letters, digits, `_`, `-` and `.`, at most 64 characters. */
const NAME = /^[A-Za-z0-9_.-]{1,64}$/;

const numberFormats = new Map<string, Intl.NumberFormat | null>();
const pluralRules = new Map<string, Intl.PluralRules | null>();

function cached<T>(cache: Map<string, T | null>, locale: string, make: () => T): T | null {
  if (cache.has(locale)) return cache.get(locale) ?? null;
  let value: T | null = null;
  try {
    value = make();
  } catch {
    value = null;
  }
  if (cache.size > 64) cache.clear();
  cache.set(locale, value);
  return value;
}

function formatNumber(value: number, locale: string): string {
  if (!Number.isFinite(value)) return String(value);
  const format = cached(numberFormats, locale, () => new Intl.NumberFormat(locale));
  return format ? format.format(value) : String(value);
}

function valueText(value: string | number | undefined, locale: string): string | undefined {
  if (typeof value === 'number') return formatNumber(value, locale);
  return typeof value === 'string' ? value : undefined;
}

/**
 * Substitute `{name}` placeholders in one pass. An unknown or malformed
 * placeholder stays literal; `count` (when given) replaces a bare `#`.
 */
export function interpolate(
  template: string,
  values: MessageValues | undefined,
  locale = 'en',
  count?: string
): string {
  if (template.indexOf('{') === -1 && (count === undefined || template.indexOf('#') === -1)) {
    return template;
  }
  let out = '';
  let index = 0;
  while (index < template.length) {
    const char = template[index] as string;
    if (char === '#' && count !== undefined) {
      out += count;
      index += 1;
      continue;
    }
    if (char === '{') {
      // Names are short: look at most 65 characters ahead, so a run of `{` stays linear.
      const close = template.slice(index + 1, index + 66).indexOf('}') + index + 1;
      if (close > index) {
        const name = template.slice(index + 1, close);
        const text = NAME.test(name) ? valueText(values?.[name], locale) : undefined;
        if (text !== undefined) {
          out += text;
          index = close + 1;
          continue;
        }
      }
    }
    out += char;
    index += 1;
  }
  return out;
}

/**
 * The small English-path formatter: `{name}` placeholders only, values
 * inserted with `String()`, unknown names left as written. One regex pass
 * with a bounded name, so it is linear and never rescans a value.
 */
export function fillPlaceholders(template: string, values?: MessageValues): string {
  if (!values || template.indexOf('{') === -1) return template;
  return template.replace(/\{([A-Za-z0-9_.-]{1,64})\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function caseText(message: Readonly<Record<string, unknown>>, key: string): string | undefined {
  if (!Object.hasOwn(message, key)) return undefined;
  const value = message[key];
  return typeof value === 'string' ? value : undefined;
}

/** Format one message for `locale`. A malformed message formats as the empty string. */
export function formatMessage(message: Message, values?: MessageValues, locale = 'en'): string {
  if (typeof message === 'string') return interpolate(message, values, locale);
  if (!isRecord(message)) return '';
  const other = caseText(message, 'other') ?? '';
  if (typeof message.plural === 'string') {
    const raw = values?.[message.plural];
    const count = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(count)) return interpolate(other, values, locale);
    const exact = caseText(message, `=${count}`);
    const rules = cached(pluralRules, locale, () => new Intl.PluralRules(locale));
    const category = rules ? rules.select(count) : count === 1 ? 'one' : 'other';
    const chosen = exact ?? caseText(message, category) ?? other;
    return interpolate(chosen, values, locale, formatNumber(count, locale));
  }
  if (typeof message.select === 'string') {
    const raw = values?.[message.select];
    const key = raw === undefined ? '' : String(raw);
    const chosen =
      key !== '' && key !== 'select' && key !== 'other' ? (caseText(message, key) ?? other) : other;
    return interpolate(chosen, values, locale);
  }
  return '';
}
