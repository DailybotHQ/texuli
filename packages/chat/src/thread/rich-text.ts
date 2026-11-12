import { type MdInline, parseInlineMarkdown } from '@texuli/core/markdown';
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

/** Date and status chips inside plain text (mentions have the link shape and come from links). */
const CHIP = /\[\[date:([^\]\s]+)\]\]|\[\[status:([a-z]+)\|([^\]\n]+)\]\]/g;

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

/** The plain text of inline nodes (formatting inside a chat span is flattened). */
function plain(nodes: readonly MdInline[]): string {
  let out = '';
  for (const node of nodes) {
    if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'html')
      out += node.value;
    else if (node.type === 'break') out += '\n';
    else if (node.type === 'image') out += node.alt;
    else if ('children' in node) out += plain(node.children as MdInline[]);
  }
  return out;
}

/** Plain text with its date and status chips; a chip that fails its check stays text. */
function textWithChips(value: string, parts: MessageTextPart[]): void {
  let cursor = 0;
  for (const match of value.matchAll(CHIP)) {
    const index = match.index ?? 0;
    let part: MessageTextPart | null = null;
    if (match[1]) {
      const iso = isoDate(match[1]);
      if (iso) part = { type: 'date', value: match[1], iso };
    } else if (match[2] && match[3]) {
      const text = label(match[3]);
      if (text && isTone(match[2])) part = { type: 'status', value: text, tone: match[2] };
    }
    if (!part) continue;
    if (index > cursor) pushText(parts, value.slice(cursor, index));
    parts.push(part);
    cursor = index + match[0].length;
  }
  if (cursor < value.length) pushText(parts, value.slice(cursor));
}

function pushText(parts: MessageTextPart[], value: string): void {
  if (!value) return;
  const last = parts[parts.length - 1];
  if (last?.type === 'text') parts[parts.length - 1] = { type: 'text', value: last.value + value };
  else parts.push({ type: 'text', value });
}

/**
 * Parse a small inline subset into text-only nodes; links use the untrusted
 * URL policy. Mentions, dates and status chips are closed node types (G21):
 * a token that fails its check stays visible as literal text.
 *
 * The message is read by the shared CommonMark inline parser (`@texuli/core/markdown`,
 * ADR-034; no block structure, no GFM) and filtered down to this vocabulary: `**strong**`,
 * `*em*`, `` `code` `` and links stay flat spans (formatting inside them is read as plain
 * text), an image reads as `!` and a link, raw HTML stays literal text, and a refused link or
 * mention keeps its exact source text.
 */
export function parseMessageText(value: string): MessageTextPart[] {
  const source = String(value ?? '').replace(/\r\n?/g, '\n');
  const parts: MessageTextPart[] = [];
  const nodes = parseInlineMarkdown(source, { gfm: false }).children;
  const literal = (node: MdInline) =>
    'position' in node && node.position
      ? source.slice(node.position.start, node.position.end)
      : plain([node]);
  nodes.forEach((node) => {
    switch (node.type) {
      case 'text':
        textWithChips(node.value, parts);
        return;
      case 'break':
        pushText(parts, '\n');
        return;
      case 'strong':
        parts.push({ type: 'strong', value: plain(node.children) });
        return;
      case 'emphasis':
        parts.push({ type: 'em', value: plain(node.children) });
        return;
      case 'inlineCode':
        parts.push({ type: 'code', value: node.value });
        return;
      case 'link': {
        const text = plain(node.children);
        // `@[Name](mention:id)`: a mention when the text before ends with `@`.
        const previous = parts[parts.length - 1];
        if (
          node.url.startsWith('mention:') &&
          previous?.type === 'text' &&
          previous.value.endsWith('@')
        ) {
          const id = node.url.slice('mention:'.length);
          const name = label(text);
          const before = previous.value.slice(0, -1);
          if (before) parts[parts.length - 1] = { type: 'text', value: before };
          else parts.pop();
          if (name && MENTION_ID.test(id)) parts.push({ type: 'mention', value: name, id });
          else pushText(parts, `@${literal(node)}`);
          return;
        }
        const href = safeHref(node.url, 'untrusted');
        if (href && text) parts.push({ type: 'link', value: text, href });
        else pushText(parts, literal(node));
        return;
      }
      case 'image': {
        // No pictures in messages: the `!` stays text and the description is a link.
        const href = safeHref(node.url, 'untrusted');
        if (href && node.alt) {
          pushText(parts, '!');
          parts.push({ type: 'link', value: node.alt, href });
        } else pushText(parts, literal(node));
        return;
      }
      default:
        // Raw HTML and anything else stays literal text.
        pushText(parts, 'value' in node ? String(node.value) : plain([node]));
    }
  });
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
