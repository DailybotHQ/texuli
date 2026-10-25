import { safeHref } from '@texuli/core/url-policy';

/** The closed set of status chip tones (G21). */
export const MESSAGE_STATUS_TONES = ['neutral', 'info', 'success', 'warning', 'danger'] as const;
export type MessageStatusTone = (typeof MESSAGE_STATUS_TONES)[number];

export type MessageTextPart =
  | { type: 'text'; value: string }
  | { type: 'strong' | 'em' | 'code'; value: string }
  | { type: 'link'; value: string; href: string }
  /** `@[Name](mention:id)`: a person or agent; `value` is the display name. */
  | { type: 'mention'; value: string; id: string }
  /** `[[date:ISO]]`: a moment shown in the reader's locale; `iso` is normalized. */
  | { type: 'date'; value: string; iso: string }
  /** `[[status:tone|Label]]`: a status chip from the closed tone set. */
  | { type: 'status'; value: string; tone: MessageStatusTone };

const MAX_TOKEN_LABEL = 64;
const MENTION_ID = /^[A-Za-z0-9._:-]{1,64}$/;
const ISO_DATE =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/;

// Mentions come before links: `@[x](mention:y)` also has the link shape.
const INLINE =
  /@\[([^\]\n]+)\]\(mention:([^)\s]+)\)|\[\[date:([^\]\s]+)\]\]|\[\[status:([a-z]+)\|([^\]\n]+)\]\]|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|`([^`\n]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

function isTone(value: string): value is MessageStatusTone {
  return (MESSAGE_STATUS_TONES as readonly string[]).includes(value);
}

function label(value: string): string | null {
  const trimmed = value.trim();
  return trimmed !== '' && trimmed.length <= MAX_TOKEN_LABEL ? trimmed : null;
}

function isoDate(value: string): string | null {
  if (!ISO_DATE.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Parse a small inline subset into text-only nodes; links use the untrusted
 * URL policy. Mentions, dates and status chips are closed node types (G21):
 * a token that fails its check stays visible as literal text.
 */
export function parseMessageText(value: string): MessageTextPart[] {
  const parts: MessageTextPart[] = [];
  let cursor = 0;
  for (const match of value.matchAll(INLINE)) {
    const index = match.index ?? 0;
    if (index > cursor) parts.push({ type: 'text', value: value.slice(cursor, index) });
    const raw = match[0];
    cursor = index + raw.length;
    if (match[1] && match[2]) {
      const name = label(match[1]);
      if (name && MENTION_ID.test(match[2])) {
        parts.push({ type: 'mention', value: name, id: match[2] });
        continue;
      }
    } else if (match[3]) {
      const iso = isoDate(match[3]);
      if (iso) {
        parts.push({ type: 'date', value: match[3], iso });
        continue;
      }
    } else if (match[4] && match[5]) {
      const text = label(match[5]);
      if (text && isTone(match[4])) {
        parts.push({ type: 'status', value: text, tone: match[4] });
        continue;
      }
    } else if (match[6]) {
      parts.push({ type: 'strong', value: match[6] });
      continue;
    } else if (match[7]) {
      parts.push({ type: 'em', value: match[7] });
      continue;
    } else if (match[8]) {
      parts.push({ type: 'code', value: match[8] });
      continue;
    } else if (match[9] && match[10]) {
      const href = safeHref(match[10], 'untrusted');
      if (href) {
        parts.push({ type: 'link', value: match[9], href });
        continue;
      }
    }
    parts.push({ type: 'text', value: raw });
  }
  if (cursor < value.length) parts.push({ type: 'text', value: value.slice(cursor) });
  return parts;
}

// Characters that would end a token early are dropped from composed labels.
function tokenLabel(value: string): string {
  return value
    .replace(/[[\]()|\n\r]/g, '')
    .trim()
    .slice(0, MAX_TOKEN_LABEL);
}

/**
 * Token builders for host composers (the G21 composer contract): a host
 * composer inserts these strings into the draft, and `parseMessageText`
 * reads them back as closed nodes. Each returns `null` for input that would
 * not parse.
 */
export const messageTokens = Object.freeze({
  mention(name: string, id: string): string | null {
    const text = tokenLabel(name);
    return text !== '' && MENTION_ID.test(id) ? `@[${text}](mention:${id})` : null;
  },
  date(value: Date | string | number): string | null {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : `[[date:${date.toISOString()}]]`;
  },
  status(tone: MessageStatusTone, text: string): string | null {
    const chip = tokenLabel(text);
    return chip !== '' && isTone(tone) ? `[[status:${tone}|${chip}]]` : null;
  },
});
