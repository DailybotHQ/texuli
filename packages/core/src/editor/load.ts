import type { HrefTrust } from '../url/safe-href.ts';
import { safeHref } from '../url/safe-href.ts';
import {
  type EditorIdSource,
  LANG_PATTERN,
  nextEditorId,
  normalizeDocument,
  paragraph,
} from './document.ts';
import { cleanText, normalizeInline, textToInline } from './inline.ts';
import {
  EDITOR_LIMITS,
  type EditorBlock,
  type EditorDocument,
  type EditorInline,
  type EditorIssue,
  type EditorIssueCode,
  type EditorLimits,
  type EditorListItem,
  type EditorListKind,
  type EditorMark,
} from './types.ts';

export interface EditorLoadOptions {
  /** URL policy tier for link hrefs. Default `untrusted`. */
  trust?: HrefTrust;
  newId?: EditorIdSource;
  /** Lower caps (a blocks `text` field holds 4,000 characters). */
  limits?: Partial<EditorLimits>;
}

export interface EditorLoadResult {
  doc: EditorDocument;
  diagnostics: readonly EditorIssue[];
}

const MAX_DIAGNOSTICS = 50;

/** Caps shared by the loaders: blocks, characters and diagnostics. Internal. */
export class LoadBudget {
  readonly diagnostics: EditorIssue[] = [];
  readonly limits: EditorLimits;
  readonly trust: HrefTrust;
  readonly newId: EditorIdSource;
  blocks = 0;
  chars = 0;
  private readonly once = new Set<string>();

  constructor(options: EditorLoadOptions) {
    this.limits = { ...EDITOR_LIMITS, ...options.limits };
    this.trust = options.trust === 'developer' ? 'developer' : 'untrusted';
    this.newId = options.newId ?? nextEditorId;
  }

  report(code: EditorIssueCode, message: string, onlyOnce = true): void {
    if (onlyOnce && this.once.has(code)) return;
    this.once.add(code);
    if (this.diagnostics.length < MAX_DIAGNOSTICS) this.diagnostics.push({ code, message });
  }

  /** Reserve one block; false (reported) once the cap is reached. */
  block(): boolean {
    if (this.blocks >= this.limits.blocks) {
      this.report('blocks-capped', `Blocks after the first ${this.limits.blocks} were dropped.`);
      return false;
    }
    this.blocks += 1;
    return true;
  }

  /** Keep as much of `text` as the character cap allows. */
  text(text: string): string {
    const room = Math.max(0, this.limits.chars - this.chars);
    if (text.length > room) {
      this.report('text-truncated', `Text after ${this.limits.chars} characters was dropped.`);
      text = text.slice(0, room);
    }
    this.chars += text.length;
    return text;
  }

  clean(text: string, keep: string): string {
    const clean = cleanText(text, keep);
    if (clean.stripped)
      this.report(
        'characters-stripped',
        'Control and bidirectional override characters were removed.'
      );
    return clean.text;
  }

  /** A policy-checked href, or `undefined` (reported). */
  href(value: unknown): string | undefined {
    const href =
      typeof value === 'string' && value.length <= EDITOR_LIMITS.href
        ? safeHref(value, this.trust)
        : undefined;
    if (href === undefined)
      this.report('link-rejected', 'A link URL was refused by the URL policy; its text was kept.');
    return href;
  }

  /** Inline content for plain text under the caps. */
  inline(text: string, marks: readonly EditorMark[] = []): readonly EditorInline[] {
    const { content, stripped } = textToInline(this.text(text), marks);
    if (stripped)
      this.report(
        'characters-stripped',
        'Control and bidirectional override characters were removed.'
      );
    return content;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Plain text found in an unknown value, depth- and size-bounded. */
function plainOf(value: unknown, depth = 0, out: string[] = []): string[] {
  if (depth > 8 || out.length > 256) return out;
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value))
    for (const entry of value.slice(0, 256)) plainOf(entry, depth + 1, out);
  else if (isRecord(value)) {
    for (const key of ['text', 'content', 'blocks', 'items', 'alt'])
      if (key in value) plainOf(value[key], depth + 1, out);
  }
  return out;
}

function loadMarks(raw: unknown, budget: LoadBudget): EditorMark[] {
  if (!Array.isArray(raw)) return [];
  const marks: EditorMark[] = [];
  for (const mark of raw.slice(0, 8)) {
    const type = isRecord(mark) ? mark.type : undefined;
    if (type === 'strong' || type === 'em' || type === 'strike' || type === 'code')
      marks.push({ type });
    else if (type === 'link') {
      const href = budget.href((mark as Record<string, unknown>).href);
      if (href) marks.push({ type: 'link', href });
    } else budget.report('unknown-mark', 'Unknown marks were dropped.');
  }
  return marks;
}

function loadInline(raw: unknown, budget: LoadBudget): readonly EditorInline[] {
  if (typeof raw === 'string') return budget.inline(raw);
  if (!Array.isArray(raw)) return [];
  const out: EditorInline[] = [];
  for (const node of raw) {
    if (budget.chars >= budget.limits.chars) {
      budget.report('text-truncated', `Text after ${budget.limits.chars} characters was dropped.`);
      break;
    }
    if (isRecord(node) && node.type === 'break') {
      out.push({ type: 'break' });
      budget.chars += 1;
    } else if (isRecord(node) && node.type === 'text' && typeof node.text === 'string') {
      out.push(...budget.inline(node.text, loadMarks(node.marks, budget)));
    } else budget.report('invalid-shape', 'Malformed inline nodes were dropped.');
  }
  return normalizeInline(out);
}

/** Paragraphs holding the plain text of a value that cannot be kept as is. */
function degrade(raw: unknown, budget: LoadBudget): EditorBlock[] {
  const text = plainOf(raw).join(' ').replace(/\s+/g, ' ').trim();
  return text && budget.block() ? [paragraph(budget.inline(text), budget.newId())] : [];
}

function loadBlocks(raw: unknown, depth: number, budget: LoadBudget): EditorBlock[] {
  if (!Array.isArray(raw)) {
    budget.report('invalid-shape', 'Blocks must be an array.');
    return [];
  }
  const out: EditorBlock[] = [];
  for (const entry of raw) {
    if (budget.blocks >= budget.limits.blocks) {
      budget.block();
      break;
    }
    out.push(...loadBlock(entry, depth, budget));
  }
  return out;
}

function loadBlock(raw: unknown, depth: number, budget: LoadBudget): EditorBlock[] {
  if (!isRecord(raw)) {
    budget.report('invalid-shape', 'Malformed blocks were dropped.');
    return [];
  }
  const type = raw.type;
  if (type === 'list' || type === 'quote') {
    if (depth >= budget.limits.depth) {
      budget.report(
        'depth-capped',
        `Lists and quotes deeper than ${budget.limits.depth} levels became text.`
      );
      return degrade(raw, budget);
    }
    if (!budget.block()) return [];
    const id = budget.newId();
    if (type === 'quote') {
      const blocks = loadBlocks(raw.blocks, depth + 1, budget);
      return blocks.length ? [{ id, type: 'quote', blocks }] : [];
    }
    const kind: EditorListKind =
      raw.kind === 'ordered' || raw.kind === 'todo' ? raw.kind : 'bullet';
    const items: EditorListItem[] = [];
    for (const item of Array.isArray(raw.items) ? raw.items : []) {
      if (!isRecord(item) || !budget.block()) continue;
      const blocks = loadBlocks(item.blocks, depth + 1, budget);
      items.push(
        kind === 'todo'
          ? { id: budget.newId(), checked: item.checked === true, blocks }
          : { id: budget.newId(), blocks }
      );
    }
    const start =
      typeof raw.start === 'number' && Number.isInteger(raw.start) && raw.start >= 0
        ? raw.start
        : undefined;
    return [
      kind === 'ordered' && start !== undefined
        ? { id, type: 'list', kind, start, items }
        : { id, type: 'list', kind, items },
    ];
  }
  if (
    type === 'paragraph' ||
    type === 'heading' ||
    type === 'code' ||
    type === 'divider' ||
    type === 'media'
  ) {
    if (!budget.block()) return [];
    const id = budget.newId();
    if (type === 'divider') return [{ id, type }];
    if (type === 'code') {
      const text = budget.text(budget.clean(typeof raw.text === 'string' ? raw.text : '', '\n\t'));
      const lang = typeof raw.lang === 'string' ? raw.lang.toLowerCase() : undefined;
      return [lang && LANG_PATTERN.test(lang) ? { id, type, lang, text } : { id, type, text }];
    }
    if (type === 'media') {
      const ref =
        typeof raw.ref === 'string' && raw.ref.length <= EDITOR_LIMITS.href ? raw.ref.trim() : '';
      if (!ref) {
        budget.report('invalid-shape', 'Media without a usable ref was dropped.');
        return [];
      }
      const alt = budget.text(budget.clean(typeof raw.alt === 'string' ? raw.alt : '', ''));
      return [{ id, type, ref, alt }];
    }
    const content = loadInline(raw.content, budget);
    if (type === 'heading') {
      const level = typeof raw.level === 'number' && Number.isInteger(raw.level) ? raw.level : 0;
      if (level >= 1 && level <= 6) {
        if (level > 4)
          budget.report('heading-clamped', 'Headings deeper than level 4 became level 4.');
        return [{ id, type, level: Math.min(level, 4) as 1 | 2 | 3 | 4, content }];
      }
      budget.report('invalid-shape', 'Headings without a valid level became paragraphs.');
    }
    return [{ id, type: 'paragraph', content }];
  }
  budget.report('unknown-node', 'Unknown block types became plain paragraphs.');
  return degrade(raw, budget);
}

/**
 * Load an untrusted document (stored JSON, the editor's own clipboard) into a
 * valid version 1 document. Never throws: malformed parts are dropped,
 * unknown blocks become paragraphs of their text, deep nesting and oversized
 * input are capped, and every link href passes `safeHref` at `trust`
 * (`untrusted` by default). Each degradation is reported once in
 * `diagnostics`. Every block gets a fresh id.
 */
export function loadEditorDocument(
  input: unknown,
  options: EditorLoadOptions = {}
): EditorLoadResult {
  const budget = new LoadBudget(options);
  const record = isRecord(input) ? input : null;
  if (record && record.version !== undefined && record.version !== 1) {
    budget.report(
      'version-unsupported',
      `Document version ${String(record.version)} is not supported.`
    );
    return {
      doc: normalizeDocument({ version: 1, blocks: [] }, budget.newId),
      diagnostics: budget.diagnostics,
    };
  }
  if (!record || !Array.isArray(record.blocks))
    budget.report('invalid-shape', 'A document is { version: 1, blocks: [...] }.');
  const blocks = record ? loadBlocks(record.blocks ?? [], 0, budget) : [];
  return {
    doc: normalizeDocument({ version: 1, blocks }, budget.newId),
    diagnostics: budget.diagnostics,
  };
}
