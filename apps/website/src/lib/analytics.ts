/**
 * Analytics event catalog, payload types and the PII sanitizer.
 *
 * This module is deliberately the only place that knows event names and
 * payload rules. The loader component and the `track` functions are later
 * tasks; they must call `sanitizeEventData` on every payload — no event
 * leaves the site with a denylisted key in it. String values are also
 * scrubbed of email-shaped substrings: denylisted keys can be audited,
 * free-text values (a pasted path, a link) cannot.
 */

/**
 * Keys that must never appear in an event payload. Matching is
 * case-insensitive substring on the key name, so `user_email` is caught.
 */
export const PII_DENYLIST_KEYS = [
  'email',
  'name',
  'message',
  'phone',
  'address',
  'password',
  'firstname',
  'lastname',
  'fullname',
  'token',
  'apikey',
] as const;

/** Event payload values are primitives only — no objects, no arrays. */
export type EventDataValue = string | number | boolean;
export type EventData = Record<string, EventDataValue>;

/**
 * Centralized event name catalog. Names are stable strings — dashboards
 * and saved segments reference them, so renaming is a breaking change.
 * Server-side bot/markdown events (ai_bot_visit, unknown_bot_visit,
 * markdown_request) are reserved here so client and edge senders share
 * one vocabulary.
 */
export const EVENTS = {
  /** Theme switch (header control): { from, to }. */
  THEME_SWITCH: 'theme_switch',
  /** "Copy page" button on a docs page: { page }. */
  CODE_COPY: 'code_copy',
  /** A component-page live demo controls open/interact: { component }. */
  DEMO_OPEN: 'component_demo_open',
  /** A studio/tool launched from a landing tool card: { studio }. */
  STUDIO_LAUNCH: 'studio_launch',
  /** An outbound link to external documentation: { url }. */
  OUTBOUND_DOC_LINK: 'outbound_doc_link',
  /** Search submitted via /search/: { query_length, results } — never the query text. */
  SEARCH: 'search',
  /** Reserved — edge: known AI bot page view (server-side only). */
  AI_BOT_VISIT: 'ai_bot_visit',
  /** Reserved — edge: unknown-bot heuristic page view (server-side only). */
  UNKNOWN_BOT_VISIT: 'unknown_bot_visit',
  /** Reserved — edge: a .md twin was served (server-side only). */
  MARKDOWN_REQUEST: 'markdown_request',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

/**
 * Client-sent events with their payload shapes — the only names `track`
 * accepts, so a typo is a type error, not a silently mangled dashboard.
 * The reserved edge events (ai_bot_visit, unknown_bot_visit,
 * markdown_request) are sent server-side and never through `track`.
 */
export type ClientEventName =
  | 'theme_switch'
  | 'code_copy'
  | 'component_demo_open'
  | 'studio_launch'
  | 'outbound_doc_link'
  | 'search';

export interface EventPayloads {
  theme_switch: { from: string; to: string };
  code_copy: { page: string };
  component_demo_open: { component: string };
  studio_launch: { studio: string };
  outbound_doc_link: { url: string };
  search: { query_length: number; results: number };
}

/** Email-shaped substrings never leave the site, in any value. The
 * character classes are the practical email shape — bounded, so a URL
 * that merely contains an address is redacted at the address, not
 * swallowed whole. */
const EMAIL_VALUE_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;

function scrubValue(value: EventDataValue): EventDataValue {
  return typeof value === 'string' ? value.replace(EMAIL_VALUE_RE, '[redacted]') : value;
}

/**
 * Strip denylisted keys from a payload before sending. Returns undefined
 * when nothing remains — callers must treat that as "send no data".
 */
export function sanitizeEventData(data?: EventData): EventData | undefined {
  if (!data) return undefined;

  const sanitized: EventData = {};
  for (const [key, value] of Object.entries(data)) {
    const lower = key.toLowerCase();
    const denied = PII_DENYLIST_KEYS.some((bad) => lower.includes(bad));
    if (!denied) {
      sanitized[key] = scrubValue(value);
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}
