/**
 * Message catalogs (ADR-016): `{ locale, messages }`, where each message id
 * is namespaced (`texuli.dialog.close`) and maps to a `Message`. Catalogs
 * may come from untrusted JSON (a translation file a host loads), so
 * `parseCatalog` checks every id, message and size and copies the result
 * into a prototype-free map.
 */
import type { Message } from './format.ts';

export interface MessageCatalog {
  /** A BCP 47 language tag, such as `en`, `pt-BR` or the pseudo-locale `en-XA`. */
  readonly locale: string;
  readonly messages: Readonly<Record<string, Message>>;
}

export interface CatalogIssue {
  /** The message id, or `''` for the catalog itself. */
  id: string;
  message: string;
}

export interface CatalogParse {
  /** The checked catalog (only its valid messages), or `null` when the catalog itself is unusable. */
  catalog: MessageCatalog | null;
  issues: CatalogIssue[];
}

/** Caps for `parseCatalog`. */
export const CATALOG_LIMITS = Object.freeze({
  /** Messages in one catalog. */
  messages: 5_000,
  /** Characters in one message string or plural or select case. */
  messageLength: 2_000,
  /** Cases in one plural or select message. */
  cases: 16,
});

/** A message id: two or more dot-separated segments of letters, digits and `-`, at most 128 characters. */
export const MESSAGE_ID = /^[A-Za-z0-9-]{1,48}(?:\.[A-Za-z0-9-]{1,48}){1,6}$/;
/** A BCP 47-like tag: letters and digits in `-` separated subtags (`en`, `pt-BR`, `zh-Hant-TW`, `en-XA`). */
export const LOCALE_TAG = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8}){0,4}$/;

const PLURAL_KEYS = new Set(['plural', 'other', 'zero', 'one', 'two', 'few', 'many']);
const EXACT_KEY = /^=\d{1,9}$/;
const CASE_KEY = /^[A-Za-z0-9_-]{1,48}$/;
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

function checkString(value: unknown): value is string {
  return typeof value === 'string' && value.length <= CATALOG_LIMITS.messageLength;
}

export type MessageCheck = { ok: true; message: Message } | { ok: false; reason: string };

const refuse = (reason: string): MessageCheck => ({ ok: false, reason });

/** A checked, frozen copy of one message, or the reason it is refused. */
export function checkMessage(value: unknown): MessageCheck {
  if (typeof value === 'string') {
    return value.length <= CATALOG_LIMITS.messageLength
      ? { ok: true, message: value }
      : refuse('the message is too long');
  }
  if (!isRecord(value)) return refuse('a message is a string, or a plural or select object');
  const keys = Object.keys(value);
  if (keys.length > CATALOG_LIMITS.cases + 1) return refuse('the message has too many cases');
  const isPlural = typeof value.plural === 'string';
  const isSelect = typeof value.select === 'string';
  if (isPlural === isSelect) {
    return refuse('a message object has exactly one of `plural` or `select`');
  }
  if (!checkString(value.other))
    return refuse('a plural or select message needs an `other` string');
  const out: Record<string, string> = Object.create(null);
  for (const key of keys) {
    if (FORBIDDEN.has(key)) return refuse(`the case \`${key}\` is not allowed`);
    const text = value[key];
    if (!checkString(text)) {
      return refuse(
        `the case \`${key}\` is not a string of at most ${CATALOG_LIMITS.messageLength} characters`
      );
    }
    if (key === 'plural' || key === 'select') {
      if (!CASE_KEY.test(text))
        return refuse(`\`${key}\` names a value: letters, digits, \`_\` or \`-\``);
    } else if (isPlural ? !PLURAL_KEYS.has(key) && !EXACT_KEY.test(key) : !CASE_KEY.test(key)) {
      return refuse(`the case \`${key}\` is not allowed`);
    }
    out[key] = text;
  }
  return { ok: true, message: Object.freeze(out) as unknown as Message };
}

/**
 * Check an untrusted catalog: the locale tag, every id (`MESSAGE_ID`), every
 * message and the caps in `CATALOG_LIMITS`. Invalid messages are dropped
 * with an issue; the rest are kept. Never throws.
 */
export function parseCatalog(input: unknown): CatalogParse {
  const issues: CatalogIssue[] = [];
  if (!isRecord(input)) {
    return { catalog: null, issues: [{ id: '', message: 'a catalog is an object' }] };
  }
  const locale = input.locale;
  if (typeof locale !== 'string' || !LOCALE_TAG.test(locale)) {
    issues.push({ id: '', message: 'the catalog needs a BCP 47 `locale`' });
    return { catalog: null, issues };
  }
  if (!isRecord(input.messages)) {
    issues.push({ id: '', message: 'the catalog needs a `messages` object' });
    return { catalog: null, issues };
  }
  const ids = Object.keys(input.messages);
  if (ids.length > CATALOG_LIMITS.messages) {
    issues.push({
      id: '',
      message: `the catalog has more than ${CATALOG_LIMITS.messages} messages`,
    });
    return { catalog: null, issues };
  }
  const messages: Record<string, Message> = Object.create(null);
  for (const id of ids) {
    if (!MESSAGE_ID.test(id)) {
      if (issues.length < 50) issues.push({ id, message: 'not a namespaced message id' });
      continue;
    }
    const checked = checkMessage(input.messages[id]);
    if (!checked.ok) {
      if (issues.length < 50) issues.push({ id, message: checked.reason });
      continue;
    }
    messages[id] = checked.message;
  }
  return { catalog: Object.freeze({ locale, messages: Object.freeze(messages) }), issues };
}
