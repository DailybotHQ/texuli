import { safeHref } from '../url/safe-href.ts';
import {
  blockText,
  type EditorLocation,
  locateBlock,
  paragraph,
  replaceBlock,
  replaceItem,
} from './document.ts';
import {
  hasMark,
  inlineText,
  mapMarks,
  sliceInline,
  spliceInline,
  textRuns,
  withMark,
} from './inline.ts';
import { caret, isCollapsed } from './selection.ts';
import {
  type EditorTransformOptions,
  insertBlock,
  setBlockType,
  toggleList,
  toggleQuote,
} from './transforms.ts';
import type { EditorMark, EditorRichBlock, EditorState, EditorTransformResult } from './types.ts';

const INLINE_RULES: readonly { pattern: RegExp; size: number; mark: EditorMark }[] = [
  { pattern: /(?:^|[^`\\])`([^`\n]+)`$/, size: 1, mark: { type: 'code' } },
  {
    pattern: /(?:^|[^*\\])\*\*([^*\s\n](?:[^*\n]*[^*\s\n])?)\*\*$/,
    size: 2,
    mark: { type: 'strong' },
  },
  { pattern: /(?:^|[^~\\])~~([^~\s\n](?:[^~\n]*[^~\s\n])?)~~$/, size: 2, mark: { type: 'strike' } },
  { pattern: /(?:^|[^*\\])\*([^*\s\n](?:[^*\n]*[^*\s\n])?)\*$/, size: 1, mark: { type: 'em' } },
];

const AUTOLINK = /(?:^|\s)((?:https?:\/\/|mailto:)[^\s]+) $/i;

/**
 * Markdown input rules, run by the binding after typed text (the result is
 * its own undo step, so undo restores the literal characters):
 *
 * - at a paragraph's start: `#`–`####` and a space make a heading; `-`, `*`
 *   or `+` and a space a bullet list; `1.` and a space an ordered list;
 *   `[ ]` or `[x]` and a space a todo; `>` and a space a quote; three
 *   backticks (and a language) and a space a code block; `---` a divider;
 * - inline: `**x**`, `*x*`, `~~x~~` and `` `x` `` mark `x`, and a typed URL
 *   followed by a space becomes a link when `safeHref` accepts it (always at
 *   the `untrusted` tier).
 *
 * Returns `null` when no rule applies.
 */
export function applyInputRules(
  state: EditorState,
  options?: EditorTransformOptions
): EditorTransformResult | null {
  if (state.selection.kind !== 'text' || !isCollapsed(state.selection)) return null;
  const { block: id, offset } = state.selection.focus;
  const location = locateBlock(state.doc, id);
  const block = location?.block;
  if (!location || !block || (block.type !== 'paragraph' && block.type !== 'heading')) return null;
  const before = blockText(block).slice(0, offset);
  if (block.type === 'paragraph' && !before.includes('\n')) {
    const result = blockRule(state, block, location, before, options);
    if (result) return result;
  }
  return inlineRule(state, block, before, offset);
}

function blockRule(
  state: EditorState,
  block: EditorRichBlock,
  location: EditorLocation,
  before: string,
  options?: EditorTransformOptions
): EditorTransformResult | null {
  const firstInItem = location.ancestors.at(-1)?.kind === 'item' && location.index === 0;
  const strip = (size: number): EditorState => ({
    ...state,
    doc: replaceBlock(state.doc, block.id, () => [
      { ...block, content: sliceInline(block.content, size) },
    ]),
    selection: caret(block.id, 0),
  });
  const accepted = (result: EditorTransformResult) => (result.ok ? result : null);
  const heading = /^(#{1,4}) $/.exec(before);
  if (heading && !firstInItem) {
    const level = (heading[1] as string).length as 1 | 2 | 3 | 4;
    return accepted(setBlockType(strip(before.length), 'heading', level, options));
  }
  if (firstInItem) return null;
  if (/^[-*+] $/.test(before)) return accepted(toggleList(strip(before.length), 'bullet', options));
  const ordered = /^(\d{1,9})[.)] $/.exec(before);
  if (ordered) {
    const result = toggleList(strip(before.length), 'ordered', options);
    const start = Number(ordered[1]);
    if (!result.ok || start === 1) return accepted(result);
    const list = locateBlock(result.state.doc, block.id)?.ancestors.at(-1);
    if (list?.kind !== 'item') return result;
    const doc = replaceBlock(result.state.doc, list.list.id, (l) => [
      { ...l, start } as typeof list.list,
    ]);
    return { ok: true, state: { ...result.state, doc } };
  }
  const todo = /^\[([ xX])\] $/.exec(before);
  if (todo) {
    const result = toggleList(strip(before.length), 'todo', options);
    if (!result.ok || todo[1] === ' ') return accepted(result);
    const item = locateBlock(result.state.doc, block.id)?.ancestors.at(-1);
    if (item?.kind !== 'item') return result;
    const doc = replaceItem(result.state.doc, item.item.id, (i) => [{ ...i, checked: true }]);
    return { ok: true, state: { ...result.state, doc } };
  }
  if (before === '> ') return accepted(toggleQuote(strip(2), options));
  const fence = /^```([a-z][a-z0-9+-]{0,31})? $/i.exec(before);
  if (fence) {
    const stripped = strip(before.length);
    const result = setBlockType(stripped, 'code', 1, options);
    if (!result.ok || !fence[1]) return accepted(result);
    const lang = fence[1].toLowerCase();
    const doc = replaceBlock(result.state.doc, block.id, (b) => [{ ...b, lang } as typeof b]);
    return { ok: true, state: { ...result.state, doc } };
  }
  if (before === '---' && inlineText(block.content) === '---') {
    const emptied: EditorState = {
      ...state,
      doc: replaceBlock(state.doc, block.id, () => [paragraph([], block.id)]),
      selection: caret(block.id, 0),
    };
    return accepted(insertBlock(emptied, { type: 'divider' }, options));
  }
  return null;
}

function inlineRule(
  state: EditorState,
  block: EditorRichBlock,
  before: string,
  offset: number
): EditorTransformResult | null {
  const done = (content: EditorRichBlock['content'], at: number): EditorTransformResult => ({
    ok: true,
    state: {
      ...state,
      doc: replaceBlock(state.doc, block.id, () => [{ ...block, content }]),
      selection: caret(block.id, at),
      storedMarks: null,
    },
  });
  for (const { pattern, size, mark } of INLINE_RULES) {
    const match = pattern.exec(before);
    if (!match) continue;
    const inner = match[1] as string;
    const close = offset - size;
    const start = close - inner.length;
    const open = start - size;
    const runs = textRuns(block.content, open, offset);
    if (runs.some((run) => hasMark(run.marks, 'code'))) continue;
    let content = spliceInline(block.content, close, offset);
    content = mapMarks(content, start, close, (marks) => withMark(marks, mark));
    content = spliceInline(content, open, start);
    return done(content, offset - 2 * size);
  }
  const link = AUTOLINK.exec(before);
  if (link) {
    const url = link[1] as string;
    const href = safeHref(url, 'untrusted');
    const end = offset - 1;
    const start = end - url.length;
    const runs = textRuns(block.content, start, end);
    if (href && !runs.some((run) => hasMark(run.marks, 'link') || hasMark(run.marks, 'code'))) {
      return done(
        mapMarks(block.content, start, end, (marks) => withMark(marks, { type: 'link', href })),
        offset
      );
    }
  }
  return null;
}
