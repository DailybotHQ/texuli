import { isoDateToDays } from '@texuli/core/expression';
import { safeHref } from '@texuli/core/url-policy';
import type { FormFormat } from './types.ts';

/*
 * The named formats. Each check is owned code: either a hand-written scan or
 * an anchored pattern with no ambiguous repetition, run on input capped at
 * 1,000 characters, so every check is linear. Schemas only name a format;
 * they never carry a pattern.
 */

const MAX_INPUT = 1000;

const PATTERNS: Readonly<Partial<Record<FormFormat, RegExp>>> = Object.freeze({
  'postal-code-us': /^\d{5}(?:-\d{4})?$/,
  'postal-code-ca': /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/,
  'postal-code-uk': /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/,
  'postal-code-de': /^\d{5}$/,
  'postal-code-fr': /^\d{5}$/,
  'postal-code-es': /^\d{5}$/,
  'postal-code-mx': /^\d{5}$/,
  'postal-code-br': /^\d{5}-?\d{3}$/,
  'postal-code-co': /^\d{6}$/,
  'postal-code-in': /^\d{6}$/,
  'postal-code-jp': /^\d{3}-?\d{4}$/,
  'postal-code-au': /^\d{4}$/,
  digits: /^\d+$/,
  alphanumeric: /^[A-Za-z0-9]+$/,
  slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  time: /^(?:[01]\d|2[0-3]):[0-5]\d$/,
  'hex-color': /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
});

const isAlnum = (code: number) =>
  (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);

/** An address like `name@example.com`: one `@`, no spaces, a dotted domain with a 2+ letter TLD. */
function isEmail(value: string): boolean {
  if (value.length > 254) return false;
  const at = value.indexOf('@');
  if (at < 1 || at !== value.lastIndexOf('@') || at > 64) return false;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  for (let i = 0; i < local.length; i += 1) {
    const code = local.charCodeAt(i);
    if (code <= 32 || code === 127 || '()<>[]\\,;:"'.includes(local[i] as string)) return false;
  }
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  const labels = domain.split('.');
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (label.length === 0 || label.length > 63) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
    for (let i = 0; i < label.length; i += 1) {
      const code = label.charCodeAt(i);
      if (!isAlnum(code) && code !== 45 && code < 128) return false;
    }
  }
  const tld = labels[labels.length - 1] as string;
  return tld.length >= 2 && !/\d/.test(tld);
}

/** An `https:` URL with a host that the untrusted URL policy accepts. */
function isUrl(value: string): boolean {
  const safe = safeHref(value, 'untrusted');
  if (safe === undefined || !/^https:\/\/[^/?#\s]+/i.test(safe)) return false;
  try {
    return new URL(safe).hostname.length > 0;
  } catch {
    return false;
  }
}

/** A phone number: digits with optional spaces, dots, hyphens and parentheses; one leading `+`; 7–15 digits. */
function isPhone(value: string): boolean {
  let digits = 0;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i] as string;
    if (ch >= '0' && ch <= '9') digits += 1;
    else if (ch === '+') {
      if (i !== 0) return false;
    } else if (!' .-()'.includes(ch)) return false;
  }
  return digits >= 7 && digits <= 15;
}

/** A postal code from any country: 2–10 letters, digits, spaces or hyphens with a digit or letter at each end. */
function isPostalCode(value: string): boolean {
  if (value.length < 2 || value.length > 10) return false;
  if (!isAlnum(value.charCodeAt(0)) || !isAlnum(value.charCodeAt(value.length - 1))) return false;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (!isAlnum(code) && code !== 32 && code !== 45) return false;
  }
  return true;
}

/** Whether `value` matches the named format. Unknown names never match. */
export function matchesFormat(format: FormFormat, value: string): boolean {
  if (typeof value !== 'string' || value.length > MAX_INPUT) return false;
  switch (format) {
    case 'email':
      return isEmail(value);
    case 'url':
      return isUrl(value);
    case 'phone':
      return isPhone(value);
    case 'postal-code':
      return isPostalCode(value);
    case 'iso-date':
      return isoDateToDays(value) !== null;
    default: {
      const pattern = PATTERNS[format];
      return pattern ? pattern.test(value) : false;
    }
  }
}
