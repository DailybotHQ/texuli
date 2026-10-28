import { classifyMediaSource } from '../safety.ts';
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
  parseOptionalEnum,
  parseOptionalIconName,
  parseOptionalPlainText,
  parsePlainText,
} from './primitives.ts';
import {
  BLOCK_ALIGNS,
  BLOCK_TEXT_SIZES,
  type BlockAlign,
  type BlockTextSize,
  LIST_STYLES,
  type ListStyle,
} from './vocabulary.ts';

const parseAlign = (value: unknown, path: (string | number)[]) =>
  parseOptionalEnum<BlockAlign>(value, [...path, 'align'], BLOCK_ALIGNS, 'align');

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
  const align = parseAlign(record.align, path);
  if (!align.success) return align;
  return ok({
    ...base,
    type: 'heading',
    level,
    text: text.data,
    ...(eyebrow !== undefined ? { eyebrow } : {}),
    ...(subtitle !== undefined ? { subtitle } : {}),
    ...(align.data !== undefined ? { align: align.data } : {}),
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
  const size = parseOptionalEnum<BlockTextSize>(
    record.size,
    [...path, 'size'],
    BLOCK_TEXT_SIZES,
    'size'
  );
  if (!size.success) return size;
  const align = parseAlign(record.align, path);
  if (!align.success) return align;
  return ok({
    ...base,
    type: 'text',
    markdown: markdown.data,
    ...(size.data !== undefined ? { size: size.data } : {}),
    ...(align.data !== undefined ? { align: align.data } : {}),
  });
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
  const ordered = record.ordered === true ? true : record.ordered === false ? false : undefined;
  if (record.ordered !== undefined && ordered === undefined) {
    return fail([...path, 'ordered'], 'ordered must be a boolean');
  }
  const style = parseOptionalEnum<ListStyle>(
    record.style,
    [...path, 'style'],
    LIST_STYLES,
    'style'
  );
  if (!style.success) return style;
  if (ordered !== undefined && style.data !== undefined && ordered !== (style.data === 'number')) {
    return fail([...path, 'ordered'], `ordered contradicts style "${style.data}"`);
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
    const icon = parseOptionalIconName(item.data.icon, [...itemPath, 'icon']);
    if (!icon.success) return icon;
    if (style.data === 'icon' && icon.data === undefined) {
      return fail([...itemPath, 'icon'], 'style "icon" needs an icon on every item');
    }
    const done = item.data.done;
    if (done !== undefined && typeof done !== 'boolean') {
      return fail([...itemPath, 'done'], 'done must be a boolean');
    }
    if (done !== undefined && style.data !== 'check') {
      return fail([...itemPath, 'done'], 'done needs style "check"');
    }
    items.push({
      text: text.data,
      ...(icon.data !== undefined ? { icon: icon.data } : {}),
      ...(done !== undefined ? { done } : {}),
    });
  }
  return ok({
    ...base,
    type: 'list',
    items,
    ...(ordered !== undefined ? { ordered } : {}),
    ...(style.data !== undefined ? { style: style.data } : {}),
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
  const role = parseOptionalPlainText(record.role, [...path, 'role'], BLOCK_CONTENT_LIMITS.plain);
  if (!role.success) return role;
  let avatar: string | undefined;
  if (record.avatar !== undefined) {
    if (typeof record.avatar !== 'string')
      return fail([...path, 'avatar'], 'avatar must be a string');
    const source = classifyMediaSource(record.avatar, 'image');
    if (!source.ok) return fail([...path, 'avatar'], source.message);
    avatar = record.avatar;
  }
  return ok({
    ...base,
    type: 'quote',
    quote: quote.data,
    ...(cite !== undefined ? { cite } : {}),
    ...(role.data !== undefined ? { role: role.data } : {}),
    ...(avatar !== undefined ? { avatar } : {}),
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
  const icon = parseOptionalIconName(record.icon, [...path, 'icon']);
  if (!icon.success) return icon;
  return ok({
    ...base,
    type: 'callout',
    body: body.data,
    ...(title !== undefined ? { title } : {}),
    ...(icon.data !== undefined ? { icon: icon.data } : {}),
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
