import type {
  CalloutBlock,
  HeadingBlock,
  ListBlock,
  ListItem,
  QuoteBlock,
  TextBlock,
} from './blocks.ts';
import { plainObject } from './parse-family.ts';
import {
  BLOCK_CONTENT_LIMITS,
  type BlockBase,
  fail,
  ok,
  type ParseResult,
  parseMultilineText,
  parsePlainText,
} from './primitives.ts';

function parseHeading(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<HeadingBlock> {
  const level = record.level;
  if (level !== 1 && level !== 2 && level !== 3 && level !== 4) {
    return fail([...path, 'level'], 'heading level must be 1–4');
  }
  const text = parsePlainText(record.text, [...path, 'text'], BLOCK_CONTENT_LIMITS.heading);
  if (!text.success) return text;
  let eyebrow: string | undefined;
  if (record.eyebrow !== undefined) {
    const parsed = parsePlainText(record.eyebrow, [...path, 'eyebrow'], BLOCK_CONTENT_LIMITS.plain);
    if (!parsed.success) return parsed;
    eyebrow = parsed.data;
  }
  let subtitle: string | undefined;
  if (record.subtitle !== undefined) {
    const parsed = parsePlainText(
      record.subtitle,
      [...path, 'subtitle'],
      BLOCK_CONTENT_LIMITS.plain
    );
    if (!parsed.success) return parsed;
    subtitle = parsed.data;
  }
  return ok({
    ...base,
    type: 'heading',
    level,
    text: text.data,
    ...(eyebrow !== undefined ? { eyebrow } : {}),
    ...(subtitle !== undefined ? { subtitle } : {}),
  });
}

function parseTextBlock(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<TextBlock> {
  const markdown = parseMultilineText(
    record.markdown,
    [...path, 'markdown'],
    BLOCK_CONTENT_LIMITS.markdown
  );
  if (!markdown.success) return markdown;
  return ok({ ...base, type: 'text', markdown: markdown.data });
}

function parseList(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<ListBlock> {
  if (!Array.isArray(record.items) || record.items.length === 0) {
    return fail([...path, 'items'], 'list needs at least one item');
  }
  if (record.items.length > BLOCK_CONTENT_LIMITS.listItems) {
    return fail(
      [...path, 'items'],
      `list may contain at most ${BLOCK_CONTENT_LIMITS.listItems} items`
    );
  }
  const items: ListItem[] = [];
  for (let i = 0; i < record.items.length; i += 1) {
    const itemPath = [...path, 'items', i];
    const item = plainObject(record.items[i], itemPath);
    if (!item.success) return item;
    const text = parseMultilineText(
      item.data.text,
      [...itemPath, 'text'],
      BLOCK_CONTENT_LIMITS.shortMarkdown
    );
    if (!text.success) return text;
    items.push({ text: text.data });
  }
  const ordered = record.ordered === true ? true : record.ordered === false ? false : undefined;
  if (record.ordered !== undefined && ordered === undefined) {
    return fail([...path, 'ordered'], 'ordered must be a boolean');
  }
  return ok({
    ...base,
    type: 'list',
    items,
    ...(ordered !== undefined ? { ordered } : {}),
  });
}

function parseQuote(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<QuoteBlock> {
  const quote = parseMultilineText(
    record.quote,
    [...path, 'quote'],
    BLOCK_CONTENT_LIMITS.shortMarkdown
  );
  if (!quote.success) return quote;
  let cite: string | undefined;
  if (record.cite !== undefined) {
    const parsed = parsePlainText(record.cite, [...path, 'cite'], BLOCK_CONTENT_LIMITS.plain);
    if (!parsed.success) return parsed;
    cite = parsed.data;
  }
  return ok({
    ...base,
    type: 'quote',
    quote: quote.data,
    ...(cite !== undefined ? { cite } : {}),
  });
}

function parseCallout(
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<CalloutBlock> {
  const body = parseMultilineText(
    record.body,
    [...path, 'body'],
    BLOCK_CONTENT_LIMITS.shortMarkdown
  );
  if (!body.success) return body;
  let title: string | undefined;
  if (record.title !== undefined) {
    const parsed = parsePlainText(record.title, [...path, 'title'], BLOCK_CONTENT_LIMITS.plain);
    if (!parsed.success) return parsed;
    title = parsed.data;
  }
  return ok({
    ...base,
    type: 'callout',
    body: body.data,
    ...(title !== undefined ? { title } : {}),
  });
}

/** Text family: heading, text, list, quote and callout. */
export function parseTextFamilyBlock(
  type: string,
  record: Record<string, unknown>,
  path: (string | number)[],
  base: BlockBase
): ParseResult<HeadingBlock | TextBlock | ListBlock | QuoteBlock | CalloutBlock> | null {
  switch (type) {
    case 'heading':
      return parseHeading(record, path, base);
    case 'text':
      return parseTextBlock(record, path, base);
    case 'list':
      return parseList(record, path, base);
    case 'quote':
      return parseQuote(record, path, base);
    case 'callout':
      return parseCallout(record, path, base);
    default:
      return null;
  }
}
