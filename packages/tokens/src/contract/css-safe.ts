/**
 * CSS value safety for theme tokens. Values become custom properties; refuse
 * resource-loading functions and injection characters. Owned helper (no zod).
 */

/** Color functions allowed inside a CSS color value. */
const COLOR_FUNCTIONS = new Set([
  'rgb',
  'rgba',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'color',
  'color-mix',
  'var',
  'calc',
]);

const FONT_FUNCTIONS = new Set(['var']);

const FORBIDDEN_CHARS = /[;{}<>\\!]/;

/** True when every `(` follows an allowed function name and parentheses balance. */
export function safeFunctions(value: string, allowed: ReadonlySet<string>): boolean {
  let depth = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '(') {
      const name = /([A-Za-z-]+)$/.exec(value.slice(0, i))?.[1]?.toLowerCase();
      if (!name || !allowed.has(name)) return false;
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return depth === 0;
}

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const COLOR_KEYWORD = /^[a-z]{3,32}$/i;
const COLOR_FUNCTION_CHARS = /^[a-z][a-z0-9 #.,%/+\-()]*\)$/i;

/**
 * A CSS color safe to write into a custom property: hex, a keyword
 * (`transparent`, `currentcolor`, `red`), or an allowlisted color function.
 * Refuses `url(`, injection characters, and unbalanced parentheses.
 */
export function isSafeCssColor(value: string): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (v === '' || v.length > 96) return false;
  if (FORBIDDEN_CHARS.test(v)) return false;
  if (HEX_COLOR.test(v) || COLOR_KEYWORD.test(v)) return true;
  return COLOR_FUNCTION_CHARS.test(v) && safeFunctions(v, COLOR_FUNCTIONS);
}

const FONT_CHARS = /^[A-Za-z0-9 ,'"_.()-]+$/;

/**
 * A CSS font-family list: unquoted names, quoted names, and `var(--token, fallback)`.
 * Balanced quotes and parentheses only.
 */
export function isSafeFontFamily(value: string): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (v === '' || v.length > 300) return false;
  if (FORBIDDEN_CHARS.test(v)) return false;
  if (!FONT_CHARS.test(v)) return false;
  if ((v.match(/"/g)?.length ?? 0) % 2 !== 0) return false;
  if ((v.match(/'/g)?.length ?? 0) % 2 !== 0) return false;
  return safeFunctions(v, FONT_FUNCTIONS);
}

const CSS_LENGTH = /^(?:0|\d{1,5}(?:\.\d{1,4})?(?:px|rem|em|%))$/;

/** A CSS length used for radius, border width, and focus ring offsets. */
export function isSafeCssLength(value: string): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (v === '' || v.length > 32) return false;
  if (FORBIDDEN_CHARS.test(v)) return false;
  return CSS_LENGTH.test(v);
}

const EASING =
  /^(?:linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\(\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*,\s*-?\d*\.?\d+\s*\))$/;

/** A CSS easing keyword or `cubic-bezier(...)`. */
export function isSafeCssEasing(value: string): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (v === '' || v.length > 80) return false;
  if (FORBIDDEN_CHARS.test(v)) return false;
  return EASING.test(v);
}
