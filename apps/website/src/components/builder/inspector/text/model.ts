/**
 * Framework-free model for the structured `blocks-text` inspector (G16:
 * `blocks-*` props get structured editors because `@texuli/blocks` has the
 * schemas). Field limits mirror the text family parser, and validation
 * runs that parser itself (`safeParseBlock`), so the editor never accepts
 * what the block would refuse. Imports only `@texuli/blocks`, so it can
 * move into a future `@texuli/builder` unchanged.
 */
import { BLOCK_CONTENT_LIMITS, BLOCK_TONES, safeParseBlock } from '@texuli/blocks/core';
import {
  inlineText,
  type MdBlock,
  type MdInline,
  parseMarkdown,
} from '@texuli/blocks/text/markdown';

export const TEXT_TYPES = ['heading', 'text', 'list', 'quote', 'callout'] as const;
export type TextType = (typeof TEXT_TYPES)[number];

export const TEXT_TYPE_LABELS: Readonly<Record<TextType, string>> = Object.freeze({
  heading: 'Heading',
  text: 'Text',
  list: 'List',
  quote: 'Quote',
  callout: 'Callout',
});

/**
 * One editable field. `plain` is a single line; `markdown` is multi-line
 * inline markdown (links pass the untrusted URL policy at paint).
 */
export type TextField =
  | { name: string; label: string; kind: 'plain' | 'markdown'; required: boolean; max: number }
  | { name: 'level'; label: string; kind: 'level'; required: true }
  | { name: 'ordered'; label: string; kind: 'boolean'; required: false }
  | { name: 'items'; label: string; kind: 'items'; required: true; max: number; maxItems: number }
  | { name: 'tone'; label: string; kind: 'tone'; required: false };

const L = BLOCK_CONTENT_LIMITS;
const TONE: TextField = { name: 'tone', label: 'Tone', kind: 'tone', required: false };

export const TEXT_FIELDS: Readonly<Record<TextType, readonly TextField[]>> = Object.freeze({
  heading: [
    { name: 'level', label: 'Level', kind: 'level', required: true },
    { name: 'text', label: 'Heading', kind: 'plain', required: true, max: L.heading },
    { name: 'eyebrow', label: 'Eyebrow', kind: 'plain', required: false, max: L.plain },
    { name: 'subtitle', label: 'Subtitle', kind: 'plain', required: false, max: L.plain },
    TONE,
  ],
  text: [
    { name: 'markdown', label: 'Text', kind: 'markdown', required: true, max: L.markdown },
    TONE,
  ],
  list: [
    { name: 'ordered', label: 'Numbered list', kind: 'boolean', required: false },
    {
      name: 'items',
      label: 'Items',
      kind: 'items',
      required: true,
      max: L.shortMarkdown,
      maxItems: L.listItems,
    },
    TONE,
  ],
  quote: [
    { name: 'quote', label: 'Quote', kind: 'markdown', required: true, max: L.shortMarkdown },
    { name: 'cite', label: 'Attribution', kind: 'plain', required: false, max: L.plain },
    TONE,
  ],
  callout: [
    { name: 'title', label: 'Title', kind: 'plain', required: false, max: L.plain },
    { name: 'body', label: 'Body', kind: 'markdown', required: true, max: L.shortMarkdown },
    TONE,
  ],
});

/** The parser's content limits, re-exported for hosts and tests. */
export { BLOCK_CONTENT_LIMITS };

export const HEADING_LEVELS = [1, 2, 3, 4] as const;
export const TONES = BLOCK_TONES;

export type TextBlockValue = Record<string, unknown> & { type: TextType };

/** Fictional starter content for each type; every preset parses. */
export const TEXT_PRESETS: Readonly<Record<TextType, TextBlockValue>> = Object.freeze({
  heading: { type: 'heading', level: 2, text: 'Section heading' },
  text: { type: 'text', markdown: 'Write a short paragraph here.' },
  list: { type: 'list', items: [{ text: 'First point' }, { text: 'Second point' }] },
  quote: { type: 'quote', quote: 'A short, fictional quote.' },
  callout: { type: 'callout', body: 'Something the reader should notice.' },
});

export function isTextType(value: unknown): value is TextType {
  return typeof value === 'string' && (TEXT_TYPES as readonly string[]).includes(value);
}

/** The block the editor shows: the current value when it is a text type, else the text preset. */
export function editableBlock(value: unknown): TextBlockValue {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (isTextType(record.type)) return { ...record, type: record.type };
  }
  return { ...TEXT_PRESETS.text };
}

/** The main text of a block, carried across a type switch. */
export function primaryText(block: TextBlockValue): string {
  switch (block.type) {
    case 'heading':
      return typeof block.text === 'string' ? block.text : '';
    case 'text':
      return typeof block.markdown === 'string' ? block.markdown : '';
    case 'quote':
      return typeof block.quote === 'string' ? block.quote : '';
    case 'callout':
      return typeof block.body === 'string' ? block.body : '';
    case 'list': {
      const items = Array.isArray(block.items) ? block.items : [];
      return items
        .map((item) => (item && typeof item === 'object' ? (item as { text?: unknown }).text : ''))
        .filter((text): text is string => typeof text === 'string' && text !== '')
        .join('\n');
    }
  }
}

/**
 * Switch the block's type, keeping its main text and its tone. A heading
 * keeps only the first line (headings are single-line); a list gets one
 * item per line, up to the item cap.
 */
export function switchType(block: TextBlockValue, type: TextType): TextBlockValue {
  if (block.type === type) return block;
  const text = primaryText(block).trim();
  const tone = typeof block.tone === 'string' ? { tone: block.tone } : {};
  if (text === '') return { ...TEXT_PRESETS[type], ...tone };
  switch (type) {
    case 'heading':
      return {
        type,
        level: 2,
        text: (text.split('\n')[0] ?? '').slice(0, L.heading),
        ...tone,
      };
    case 'text':
      return { type, markdown: text.slice(0, L.markdown), ...tone };
    case 'quote':
      return { type, quote: text.slice(0, L.shortMarkdown), ...tone };
    case 'callout':
      return { type, body: text.slice(0, L.shortMarkdown), ...tone };
    case 'list': {
      const lines = text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      return {
        type,
        items: lines
          .slice(0, L.listItems)
          .map((line) => ({ text: line.slice(0, L.shortMarkdown) })),
        ...tone,
      };
    }
  }
}

/**
 * Set one field. An empty optional field (`''`, `undefined`, `false` for
 * `ordered`) is removed instead of written, so payloads stay minimal.
 */
export function setField(block: TextBlockValue, name: string, value: unknown): TextBlockValue {
  const field = TEXT_FIELDS[block.type].find((candidate) => candidate.name === name);
  if (!field) return block;
  const empty =
    value === undefined || value === '' || (field.kind === 'boolean' && value === false);
  if (empty && !field.required) {
    const { [name]: _removed, ...rest } = block;
    return rest as TextBlockValue;
  }
  return { ...block, [name]: value };
}

/** List items as strings (missing or malformed items become empty strings). */
export function itemTexts(block: TextBlockValue): string[] {
  const items = Array.isArray(block.items) ? block.items : [];
  return items.map((item) =>
    item && typeof item === 'object' && typeof (item as { text?: unknown }).text === 'string'
      ? (item as { text: string }).text
      : ''
  );
}

export type ItemAction =
  | { action: 'set'; index: number; text: string }
  | { action: 'add'; after: number }
  | { action: 'remove'; index: number }
  | { action: 'move'; index: number; step: 1 | -1 };

/** List item edits, kept within 1..`listItems` items. Returns the block unchanged when refused. */
export function editItems(block: TextBlockValue, edit: ItemAction): TextBlockValue {
  const items = itemTexts(block);
  if (edit.action === 'set') {
    if (edit.index < 0 || edit.index >= items.length) return block;
    items[edit.index] = edit.text;
  } else if (edit.action === 'add') {
    if (items.length >= L.listItems) return block;
    items.splice(Math.min(Math.max(edit.after + 1, 0), items.length), 0, '');
  } else if (edit.action === 'remove') {
    if (items.length <= 1 || edit.index < 0 || edit.index >= items.length) return block;
    items.splice(edit.index, 1);
  } else {
    const to = edit.index + edit.step;
    if (edit.index < 0 || edit.index >= items.length || to < 0 || to >= items.length) return block;
    const [moved] = items.splice(edit.index, 1);
    items.splice(to, 0, moved ?? '');
  }
  return { ...block, items: items.map((text) => ({ text })) };
}

export interface FieldIssue {
  /** Field name, or `items.<index>` for one list item. */
  field: string;
  message: string;
}

/** Problems the text family parser reports, keyed to editor fields. */
export function validateTextBlock(block: TextBlockValue): FieldIssue[] {
  const result = safeParseBlock(block);
  if (result.success) return [];
  return result.issues.map((issue) => {
    const [first, second] = issue.path;
    const field =
      first === 'items' && typeof second === 'number'
        ? `items.${second}`
        : typeof first === 'string'
          ? first
          : 'type';
    return { field, message: issue.message };
  });
}

/** Characters left before a field's cap (counted as code points, like the parser). */
export function remaining(text: string, max: number): number {
  return max - [...text].length;
}

export interface LinkVerdict {
  /** The link text as the reader sees it. */
  text: string;
  /** The href that will paint, or `undefined` when the URL policy refused it. */
  href: string | undefined;
  kept: boolean;
}

/**
 * Every link in a markdown field, with the verdict the paint will apply.
 * This walks the same parse the renderer uses, and that parse already runs
 * each href through `safeHref` (untrusted tier), so the verdict cannot
 * differ from what paints.
 */
export function linkVerdicts(markdown: string): LinkVerdict[] {
  const verdicts: LinkVerdict[] = [];
  const inline = (nodes: readonly MdInline[]) => {
    for (const node of nodes) {
      if (node.type === 'link') {
        verdicts.push({
          text: inlineText(node.children),
          href: node.href,
          kept: node.href !== undefined,
        });
      } else if ('children' in node) {
        inline(node.children);
      }
    }
  };
  const block = (node: MdBlock) => {
    if (node.type === 'paragraph' || node.type === 'heading') inline(node.children);
    else if (node.type === 'quote') node.children.forEach(block);
    else if (node.type === 'list') for (const item of node.items) item.children.forEach(block);
  };
  parseMarkdown(markdown).blocks.forEach(block);
  return verdicts;
}
