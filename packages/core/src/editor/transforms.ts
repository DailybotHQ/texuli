import { type HrefTrust, safeHref } from '../url/safe-href.ts';
import { resolveTrust } from '../url-policy/trust.ts';
import {
  blockLength,
  blockText,
  type EditorAncestor,
  type EditorIdSource,
  type EditorLocation,
  editorBlockCount,
  editorCharCount,
  editorLeaves,
  isTextBlock,
  locateBlock,
  nextEditorId,
  normalizeDocument,
  paragraph,
  removeBlocks,
  replaceBlock,
  replaceItem,
} from './document.ts';
import { nextGrapheme, nextWord, previousGrapheme, previousWord } from './graphemes.ts';
import {
  cleanText,
  concatInline,
  hasMark,
  inheritedMarks,
  inlineLength,
  inlineText,
  mapMarks,
  markKey,
  sliceInline,
  spliceInline,
  textRuns,
  textToInline,
  withMark,
  withoutMark,
} from './inline.ts';
import { caret, clampSelection, isCollapsed, nodeSelection, selectionRange } from './selection.ts';
import {
  EDITOR_LIMITS,
  type EditorBlock,
  type EditorBlockId,
  type EditorDocument,
  type EditorHeadingLevel,
  type EditorInline,
  type EditorIssue,
  type EditorLimits,
  type EditorList,
  type EditorListItem,
  type EditorListKind,
  type EditorMarkType,
  type EditorRichBlock,
  type EditorSelection,
  type EditorState,
  type EditorTextBlock,
  type EditorTransformResult,
} from './types.ts';

export interface EditorTransformOptions {
  newId?: EditorIdSource;
  /** Lower caps for this editor (a blocks `text` field holds 4,000 characters). */
  limits?: Partial<EditorLimits>;
}

interface Context {
  newId: EditorIdSource;
  limits: EditorLimits;
}

const context = (options: EditorTransformOptions = {}): Context => ({
  newId: options.newId ?? nextEditorId,
  limits: { ...EDITOR_LIMITS, ...options.limits },
});

const fail = (code: EditorIssue['code'], message: string): EditorTransformResult => ({
  ok: false,
  errors: [{ code, message }],
});

/** Normalize, clamp the selection and check the caps; refuse when a cap is passed. */
function done(
  doc: EditorDocument,
  selection: EditorSelection,
  c: Context,
  diagnostics: readonly EditorIssue[] = [],
  storedMarks: EditorState['storedMarks'] = null
): EditorTransformResult {
  const next = normalizeDocument(doc, c.newId);
  if (editorCharCount(next) > c.limits.chars) {
    return fail('limit-reached', `The document holds at most ${c.limits.chars} characters.`);
  }
  if (editorBlockCount(next.blocks) > c.limits.blocks) {
    return fail('limit-reached', `The document holds at most ${c.limits.blocks} blocks.`);
  }
  if (maxDepth(next.blocks) > c.limits.depth) {
    return fail('depth-capped', `Lists and quotes nest at most ${c.limits.depth} levels.`);
  }
  const state: EditorState = { doc: next, selection: clampSelection(next, selection), storedMarks };
  return diagnostics.length ? { ok: true, state, diagnostics } : { ok: true, state };
}

/** Container nesting of a block tree (lists and quotes). */
function maxDepth(blocks: readonly EditorBlock[]): number {
  let depth = 0;
  for (const block of blocks) {
    if (block.type === 'quote') depth = Math.max(depth, 1 + maxDepth(block.blocks));
    else if (block.type === 'list')
      for (const item of block.items) depth = Math.max(depth, 1 + maxDepth(item.blocks));
  }
  return depth;
}

const textLeaf = (doc: EditorDocument, id: EditorBlockId): EditorTextBlock | undefined => {
  const block = locateBlock(doc, id)?.block;
  return block && isTextBlock(block) ? block : undefined;
};

const isRich = (block: EditorBlock): block is EditorRichBlock =>
  block.type === 'paragraph' || block.type === 'heading';

const parentOf = (location: EditorLocation): EditorAncestor | undefined =>
  location.ancestors.at(-1);

const isFirstInItem = (location: EditorLocation) =>
  parentOf(location)?.kind === 'item' && location.index === 0;

/** Inline content of a text block between two offsets (code text becomes plain runs). */
const asInline = (block: EditorTextBlock, from: number, to?: number): readonly EditorInline[] =>
  block.type === 'code'
    ? textToInline(block.text.slice(from, to)).content
    : sliceInline(block.content, from, to);

const asCode = (block: EditorTextBlock, from: number, to?: number): string =>
  block.type === 'code'
    ? block.text.slice(from, to)
    : inlineText(sliceInline(block.content, from, to));

/** `target` up to `a`, followed by `source` from `b`, in `target`'s type. */
function joined(
  target: EditorTextBlock,
  a: number,
  source: EditorTextBlock,
  b: number
): EditorTextBlock {
  if (target.type === 'code')
    return { ...target, text: target.text.slice(0, a) + asCode(source, b) };
  return {
    ...target,
    content: concatInline(sliceInline(target.content, 0, a), asInline(source, b)),
  };
}

/** Replace the siblings of a location (the document, a quote's or an item's blocks). */
function withSiblings(
  doc: EditorDocument,
  location: EditorLocation,
  blocks: readonly EditorBlock[]
): EditorDocument {
  const parent = parentOf(location);
  if (!parent) return { ...doc, blocks };
  if (parent.kind === 'quote')
    return replaceBlock(doc, parent.quote.id, (quote) => [{ ...quote, blocks } as EditorBlock]);
  return replaceItem(doc, parent.item.id, (item) => [{ ...item, blocks }]);
}

/** Delete `[from, to)` across blocks; the caret ends at `from`. */
function deleteRange(
  state: EditorState,
  c: Context
): { doc: EditorDocument; selection: EditorSelection } | null {
  const range = selectionRange(state.doc, state.selection);
  if (!range) return null;
  const { from, to } = range;
  const leaves = editorLeaves(state.doc);
  const target = leaves[from.index]?.block;
  const source = leaves[to.index]?.block;
  if (!target || !source || !isTextBlock(target) || !isTextBlock(source)) return null;
  let doc = replaceBlock(state.doc, target.id, () => [
    joined(target, from.offset, source, to.offset),
  ]);
  if (from.index !== to.index) {
    const removed = new Set(
      leaves.slice(from.index + 1, to.index + 1).map(({ block }) => block.id)
    );
    doc = removeBlocks(doc, removed, c.newId);
  }
  return { doc, selection: caret(target.id, from.offset) };
}

/** Remove a void block; the caret moves to the nearest text block. */
function removeNode(doc: EditorDocument, id: EditorBlockId, c: Context): EditorTransformResult {
  const leaves = editorLeaves(doc).map(({ block }) => block);
  const index = leaves.findIndex((block) => block.id === id);
  if (index === -1) return fail('invalid-selection', 'The selected block is not in the document.');
  const before = leaves.slice(0, index).findLast(isTextBlock);
  const after = leaves.slice(index + 1).find(isTextBlock);
  let next = removeBlocks(doc, new Set([id]), c.newId);
  let selection: EditorSelection;
  if (before) selection = caret(before.id, blockLength(before));
  else if (after) selection = caret(after.id, 0);
  else {
    const empty = paragraph([], c.newId());
    next = { ...next, blocks: [...next.blocks, empty] };
    selection = caret(empty.id);
  }
  return done(next, selection, c);
}

/** Collapse the selection to a caret in a text block (deleting a range, replacing a node with a paragraph). */
function prepare(
  state: EditorState,
  c: Context
): { doc: EditorDocument; block: EditorTextBlock; offset: number } | null {
  let { doc, selection } = state;
  if (selection.kind === 'node') {
    const empty = paragraph([], c.newId());
    doc = replaceBlock(doc, selection.block, () => [empty]);
    return { doc, block: empty, offset: 0 };
  }
  if (!isCollapsed(selection)) {
    const deleted = deleteRange(state, c);
    if (!deleted) return null;
    doc = deleted.doc;
    selection = deleted.selection;
  }
  if (selection.kind !== 'text') return null;
  const block = textLeaf(doc, selection.focus.block);
  return block
    ? { doc, block, offset: Math.min(selection.focus.offset, blockLength(block)) }
    : null;
}

const badSelection = () => fail('invalid-selection', 'The selection is not inside a text block.');

/**
 * Type `text` at the selection (replacing a range). Rich blocks give the text
 * the stored marks, else the marks before the caret; `\n` becomes a break.
 * Code keeps newlines and tabs. Unsafe characters are stripped.
 */
export function insertText(
  state: EditorState,
  text: string,
  options?: EditorTransformOptions
): EditorTransformResult {
  const c = context(options);
  const at = prepare(state, c);
  if (!at) return badSelection();
  const { block, offset } = at;
  let next: EditorTextBlock;
  let length: number;
  let stripped: boolean;
  if (block.type === 'code') {
    const clean = cleanText(text, '\n\t');
    next = { ...block, text: block.text.slice(0, offset) + clean.text + block.text.slice(offset) };
    length = clean.text.length;
    stripped = clean.stripped;
  } else {
    const marks = state.storedMarks ?? inheritedMarks(block.content, offset);
    const inserted = textToInline(text, marks);
    next = { ...block, content: spliceInline(block.content, offset, offset, inserted.content) };
    length = inlineLength(inserted.content);
    stripped = inserted.stripped;
  }
  const diagnostics: EditorIssue[] = stripped
    ? [
        {
          code: 'characters-stripped',
          message: 'Control and bidirectional override characters were removed.',
        },
      ]
    : [];
  if (length === 0 && isCollapsed(state.selection)) {
    return fail('nothing-to-do', 'Nothing was left to insert.');
  }
  return done(
    replaceBlock(at.doc, block.id, () => [next]),
    caret(block.id, offset + length),
    c,
    diagnostics
  );
}

/** Shift+Enter: a break in rich blocks, a newline in code. */
export function insertBreak(
  state: EditorState,
  options?: EditorTransformOptions
): EditorTransformResult {
  const c = context(options);
  const at = prepare(state, c);
  if (!at) return badSelection();
  const { block, offset } = at;
  const next =
    block.type === 'code'
      ? { ...block, text: `${block.text.slice(0, offset)}\n${block.text.slice(offset)}` }
      : { ...block, content: spliceInline(block.content, offset, offset, [{ type: 'break' }]) };
  return done(
    replaceBlock(at.doc, block.id, () => [next]),
    caret(block.id, offset + 1),
    c
  );
}

/** Delete the selection (a range or a selected void block). */
export function deleteSelection(
  state: EditorState,
  options?: EditorTransformOptions
): EditorTransformResult {
  const c = context(options);
  if (state.selection.kind === 'node') return removeNode(state.doc, state.selection.block, c);
  if (isCollapsed(state.selection)) return fail('nothing-to-do', 'The selection is empty.');
  const deleted = deleteRange(state, c);
  return deleted ? done(deleted.doc, deleted.selection, c) : badSelection();
}

export type EditorDeleteUnit = 'grapheme' | 'word' | 'line';

function deleteBy(
  state: EditorState,
  unit: EditorDeleteUnit,
  forward: boolean,
  options?: EditorTransformOptions
): EditorTransformResult {
  if (state.selection.kind === 'node' || !isCollapsed(state.selection))
    return deleteSelection(state, options);
  const c = context(options);
  const { block: id, offset } = state.selection.focus;
  const block = textLeaf(state.doc, id);
  if (!block) return badSelection();
  const text = blockText(block);
  const end = forward ? text.length : 0;
  if (offset === end) return forward ? joinForward(state, block, c) : joinBackward(state, block, c);
  let other: number;
  if (forward) {
    other =
      unit === 'word'
        ? nextWord(text, offset)
        : unit === 'line'
          ? lineEnd(text, offset)
          : nextGrapheme(text, offset);
    if (other === offset) other = nextGrapheme(text, offset);
  } else {
    other =
      unit === 'word'
        ? previousWord(text, offset)
        : unit === 'line'
          ? text.lastIndexOf('\n', offset - 1) + 1
          : previousGrapheme(text, offset);
    if (other === offset) other = previousGrapheme(text, offset);
  }
  const [a, b] = forward ? [offset, other] : [other, offset];
  const kept: EditorTextBlock =
    block.type === 'code'
      ? { ...block, text: block.text.slice(0, a) + block.text.slice(b) }
      : {
          ...block,
          content: concatInline(sliceInline(block.content, 0, a), sliceInline(block.content, b)),
        };
  return done(
    replaceBlock(state.doc, id, () => [kept]),
    caret(id, a),
    c
  );
}

const lineEnd = (text: string, offset: number) => {
  const end = text.indexOf('\n', offset);
  return end === -1 ? text.length : end;
};

/** Backspace: delete before the caret, or apply the block-start rules (lift, join, select a void block). */
export const deleteBackward = (
  state: EditorState,
  unit: EditorDeleteUnit = 'grapheme',
  options?: EditorTransformOptions
) => deleteBy(state, unit, false, options);

/** Delete: delete after the caret, or join the next block. */
export const deleteForward = (
  state: EditorState,
  unit: EditorDeleteUnit = 'grapheme',
  options?: EditorTransformOptions
) => deleteBy(state, unit, true, options);

function joinBackward(
  state: EditorState,
  block: EditorTextBlock,
  c: Context
): EditorTransformResult {
  const { doc } = state;
  const location = locateBlock(doc, block.id) as EditorLocation;
  const parent = parentOf(location);
  const here = caret(block.id, 0);
  if (block.type === 'heading')
    return done(
      replaceBlock(doc, block.id, () => [paragraph(block.content, block.id)]),
      here,
      c
    );
  if (block.type === 'code')
    return done(
      replaceBlock(doc, block.id, () => [paragraph(asInline(block, 0), block.id)]),
      here,
      c
    );
  if (parent?.kind === 'item' && location.index === 0) {
    return done(liftItem(doc, parent.list, parent.itemIndex, c), here, c);
  }
  if (parent?.kind === 'quote' && location.index === 0) {
    const rest = parent.quote.blocks.slice(1);
    return done(
      replaceBlock(doc, parent.quote.id, (quote) => [
        block,
        ...(rest.length ? [{ ...quote, blocks: rest } as EditorBlock] : []),
      ]),
      here,
      c
    );
  }
  const leaves = editorLeaves(doc).map((leaf) => leaf.block);
  const previous = leaves[leaves.findIndex((leaf) => leaf.id === block.id) - 1];
  if (!previous) return fail('nothing-to-do', 'The caret is at the start of the document.');
  if (!isTextBlock(previous)) return done(doc, nodeSelection(previous.id), c);
  const length = blockLength(previous);
  const merged = replaceBlock(doc, previous.id, () => [joined(previous, length, block, 0)]);
  return done(removeBlocks(merged, new Set([block.id]), c.newId), caret(previous.id, length), c);
}

function joinForward(
  state: EditorState,
  block: EditorTextBlock,
  c: Context
): EditorTransformResult {
  const { doc } = state;
  const leaves = editorLeaves(doc).map((leaf) => leaf.block);
  const next = leaves[leaves.findIndex((leaf) => leaf.id === block.id) + 1];
  if (!next) return fail('nothing-to-do', 'The caret is at the end of the document.');
  if (!isTextBlock(next)) return done(doc, nodeSelection(next.id), c);
  const length = blockLength(block);
  const merged = replaceBlock(doc, block.id, () => [joined(block, length, next, 0)]);
  return done(removeBlocks(merged, new Set([next.id]), c.newId), caret(block.id, length), c);
}

/** Move item `index` of `list` out one level (nested: into the parent list; top level: out of the list). */
function liftItem(
  doc: EditorDocument,
  list: EditorList,
  index: number,
  c: Context
): EditorDocument {
  const item = list.items[index] as EditorListItem;
  const before = list.items.slice(0, index);
  const after = list.items.slice(index + 1);
  const outer = parentOf(locateBlock(doc, list.id) as EditorLocation);
  if (outer?.kind === 'item') {
    const children: EditorBlock[] = after.length
      ? [{ id: c.newId(), type: 'list', kind: list.kind, items: after }]
      : [];
    const moved: EditorListItem = { ...item, blocks: [...item.blocks, ...children] };
    return replaceItem(doc, outer.item.id, (parent) => [
      {
        ...parent,
        blocks: parent.blocks.flatMap((b) =>
          b.id === list.id ? (before.length ? [{ ...list, items: before }] : []) : [b]
        ),
      },
      moved,
    ]);
  }
  const rest: EditorList | undefined = after.length
    ? {
        id: c.newId(),
        type: 'list',
        kind: list.kind,
        items: after,
        ...(list.kind === 'ordered' ? { start: (list.start ?? 1) + index + 1 } : {}),
      }
    : undefined;
  return replaceBlock(doc, list.id, () => [
    ...(before.length ? [{ ...list, items: before }] : []),
    ...item.blocks,
    ...(rest ? [rest] : []),
  ]);
}

/** The list item nearest around the caret. */
function caretItem(
  state: EditorState
): { list: EditorList; itemIndex: number; item: EditorListItem } | null {
  if (state.selection.kind !== 'text') return null;
  const location = locateBlock(state.doc, state.selection.focus.block);
  const ancestor = location?.ancestors.findLast((a) => a.kind === 'item');
  return ancestor?.kind === 'item' ? ancestor : null;
}

/** Shift+Tab in a list: move the caret's item out one level. */
export function liftListItem(
  state: EditorState,
  options?: EditorTransformOptions
): EditorTransformResult {
  const c = context(options);
  const found = caretItem(state);
  if (!found) return fail('not-allowed-here', 'The caret is not in a list.');
  return done(liftItem(state.doc, found.list, found.itemIndex, c), state.selection, c);
}

/** Tab in a list: nest the caret's item under the previous item. */
export function sinkListItem(
  state: EditorState,
  options?: EditorTransformOptions
): EditorTransformResult {
  const c = context(options);
  const found = caretItem(state);
  if (!found) return fail('not-allowed-here', 'The caret is not in a list.');
  const { list, itemIndex, item } = found;
  const previous = list.items[itemIndex - 1];
  if (!previous) return fail('nothing-to-do', 'The first item of a list cannot be indented.');
  const last = previous.blocks.at(-1);
  const nested: EditorListItem =
    last?.type === 'list' && last.kind === list.kind
      ? {
          ...previous,
          blocks: [...previous.blocks.slice(0, -1), { ...last, items: [...last.items, item] }],
        }
      : {
          ...previous,
          blocks: [
            ...previous.blocks,
            { id: c.newId(), type: 'list', kind: list.kind, items: [item] },
          ],
        };
  const items = [...list.items.slice(0, itemIndex - 1), nested, ...list.items.slice(itemIndex + 1)];
  return done(
    replaceBlock(state.doc, list.id, () => [{ ...list, items }]),
    state.selection,
    c
  );
}

/** Mod+Enter: check or uncheck the caret's todo item. */
export function toggleTodo(
  state: EditorState,
  options?: EditorTransformOptions
): EditorTransformResult {
  const c = context(options);
  const found = caretItem(state);
  if (found?.list.kind !== 'todo')
    return fail('not-allowed-here', 'The caret is not in a todo list.');
  return done(
    replaceItem(state.doc, found.item.id, (item) => [{ ...item, checked: !item.checked }]),
    state.selection,
    c
  );
}

/**
 * Enter. Splits the block; in list items continues the list (an empty item
 * lifts out); an empty last paragraph of a quote leaves it; at the end of a
 * heading the new block is a paragraph; in code it inserts a newline, and an
 * empty last line leaves the code block.
 */
export function splitBlock(
  state: EditorState,
  options?: EditorTransformOptions
): EditorTransformResult {
  const c = context(options);
  if (state.selection.kind === 'node') {
    const empty = paragraph([], c.newId());
    return done(
      replaceBlock(state.doc, state.selection.block, (node) => [node, empty]),
      caret(empty.id),
      c
    );
  }
  const at = prepare(state, c);
  if (!at) return badSelection();
  const { doc, block, offset } = at;
  const location = locateBlock(doc, block.id) as EditorLocation;
  const parent = parentOf(location);
  const length = blockLength(block);
  if (block.type === 'code') {
    if (offset === length && block.text.endsWith('\n')) {
      const empty = paragraph([], c.newId());
      return done(
        replaceBlock(doc, block.id, () => [{ ...block, text: block.text.slice(0, -1) }, empty]),
        caret(empty.id),
        c
      );
    }
    const text = `${block.text.slice(0, offset)}\n${block.text.slice(offset)}`;
    return done(
      replaceBlock(doc, block.id, () => [{ ...block, text }]),
      caret(block.id, offset + 1),
      c
    );
  }
  const head = sliceInline(block.content, 0, offset);
  const tail = sliceInline(block.content, offset);
  if (parent?.kind === 'item' && location.index === 0) {
    if (length === 0 && parent.item.blocks.length === 1) {
      return done(liftItem(doc, parent.list, parent.itemIndex, c), caret(block.id), c);
    }
    const first = paragraph(tail, c.newId());
    const created: EditorListItem = { id: c.newId(), checked: false, blocks: [first] };
    const next = replaceItem(doc, parent.item.id, (item) => [
      { ...item, blocks: [{ ...block, content: head }, ...item.blocks.slice(1)] },
      created,
    ]);
    return done(next, caret(first.id), c);
  }
  if (parent?.kind === 'quote' && length === 0 && location.index === location.siblings.length - 1) {
    const rest = location.siblings.slice(0, -1);
    return done(
      replaceBlock(doc, parent.quote.id, (quote) => [
        ...(rest.length ? [{ ...quote, blocks: rest } as EditorBlock] : []),
        paragraph([], block.id),
      ]),
      caret(block.id),
      c
    );
  }
  if (block.type === 'heading' && offset === 0 && length > 0) {
    return done(
      replaceBlock(doc, block.id, () => [paragraph([], c.newId()), block]),
      caret(block.id),
      c
    );
  }
  const second: EditorTextBlock =
    block.type === 'heading' && offset < length
      ? { ...block, id: c.newId(), content: tail }
      : paragraph(tail, c.newId());
  return done(
    replaceBlock(doc, block.id, () => [{ ...block, content: head }, second]),
    caret(second.id),
    c
  );
}

/** Text blocks the selection touches, in order. */
function selectedTexts(state: EditorState): { block: EditorTextBlock; from: number; to: number }[] {
  const range = selectionRange(state.doc, state.selection);
  if (!range) return [];
  return editorLeaves(state.doc)
    .slice(range.from.index, range.to.index + 1)
    .flatMap(({ block }, i, all) =>
      isTextBlock(block)
        ? [
            {
              block,
              from: i === 0 ? range.from.offset : 0,
              to: i === all.length - 1 ? range.to.offset : blockLength(block),
            },
          ]
        : []
    );
}

/** Make the selected text blocks paragraphs, headings or code. A list item's first block stays a paragraph. */
export function setBlockType(
  state: EditorState,
  type: 'paragraph' | 'heading' | 'code',
  level: EditorHeadingLevel = 1,
  options?: EditorTransformOptions
): EditorTransformResult {
  const c = context(options);
  let doc = state.doc;
  let changed = false;
  for (const { block } of selectedTexts(state)) {
    if (type !== 'paragraph' && isFirstInItem(locateBlock(doc, block.id) as EditorLocation))
      continue;
    const next: EditorTextBlock =
      type === 'code'
        ? { id: block.id, type: 'code', text: asCode(block, 0) }
        : type === 'heading'
          ? { id: block.id, type: 'heading', level, content: asInline(block, 0) }
          : paragraph(asInline(block, 0), block.id);
    if (
      next.type === block.type &&
      (next.type !== 'heading' || block.type !== 'heading' || next.level === block.level)
    )
      continue;
    doc = replaceBlock(doc, block.id, () => [next]);
    changed = true;
  }
  return changed
    ? done(doc, state.selection, c)
    : fail('nothing-to-do', 'No selected block can take that type.');
}

/** The run of siblings the selection spans, in the container of its first block. */
function siblingSpan(state: EditorState): { location: EditorLocation; end: number } | null {
  const range = selectionRange(state.doc, state.selection);
  if (!range) return null;
  const location = locateBlock(state.doc, range.from.block) as EditorLocation;
  const last = locateBlock(state.doc, range.to.block) as EditorLocation;
  const depth = location.ancestors.length;
  const sameContainer = location.ancestors.every((a, i) => {
    const b = last.ancestors[i];
    return (
      b !== undefined &&
      (a.kind === 'quote'
        ? b.kind === 'quote' && b.quote.id === a.quote.id
        : b.kind === 'item' && b.item.id === a.item.id)
    );
  });
  let end = location.index;
  if (sameContainer) {
    const top = last.ancestors[depth];
    const id =
      top === undefined ? last.block.id : top.kind === 'quote' ? top.quote.id : top.list.id;
    end = Math.max(
      location.index,
      location.siblings.findIndex((b) => b.id === id)
    );
  }
  return { location, end };
}

/** Replace `siblings[index..end]` of a location with `blocks`. */
const replaceSpan = (
  doc: EditorDocument,
  location: EditorLocation,
  end: number,
  blocks: readonly EditorBlock[]
) =>
  withSiblings(doc, location, [
    ...location.siblings.slice(0, location.index),
    ...blocks,
    ...location.siblings.slice(end + 1),
  ]);

/**
 * Bullet, ordered or todo list. Inside a list of that kind the selected items
 * leave it; inside another kind the list changes kind; elsewhere the selected
 * paragraphs and headings become items.
 */
export function toggleList(
  state: EditorState,
  kind: EditorListKind,
  options?: EditorTransformOptions
): EditorTransformResult {
  const c = context(options);
  const found = caretItem({ ...state, selection: startOf(state) });
  if (found) {
    const { list } = found;
    if (list.kind !== kind)
      return done(
        replaceBlock(state.doc, list.id, () => [{ ...list, kind }]),
        state.selection,
        c
      );
    return done(liftItem(state.doc, list, found.itemIndex, c), state.selection, c);
  }
  const span = siblingSpan(state);
  if (!span) return badSelection();
  const blocks = span.location.siblings.slice(span.location.index, span.end + 1);
  if (!blocks.every(isRich))
    return fail('not-allowed-here', 'Only paragraphs and headings become list items.');
  const items: EditorListItem[] = blocks.map((block) => ({
    id: c.newId(),
    ...(kind === 'todo' ? { checked: false } : {}),
    blocks: [paragraph(block.content, block.id)],
  }));
  const list: EditorList = { id: c.newId(), type: 'list', kind, items };
  return done(replaceSpan(state.doc, span.location, span.end, [list]), state.selection, c);
}

const startOf = (state: EditorState): EditorSelection => {
  const range = selectionRange(state.doc, state.selection);
  return range ? caret(range.from.block, range.from.offset) : state.selection;
};

/** Wrap the selected blocks in a quote, or unwrap the quote around the caret. */
export function toggleQuote(
  state: EditorState,
  options?: EditorTransformOptions
): EditorTransformResult {
  const c = context(options);
  const span = siblingSpan(state);
  if (!span) return badSelection();
  const parent = parentOf(span.location);
  if (parent?.kind === 'quote') {
    return done(
      replaceBlock(state.doc, parent.quote.id, () => parent.quote.blocks),
      state.selection,
      c
    );
  }
  const blocks = span.location.siblings.slice(span.location.index, span.end + 1);
  if (isFirstInItem(span.location))
    return fail('not-allowed-here', 'A list item starts with a paragraph.');
  return done(
    replaceSpan(state.doc, span.location, span.end, [{ id: c.newId(), type: 'quote', blocks }]),
    state.selection,
    c
  );
}

/**
 * Toggle a mark over the selection (removed when every eligible character has
 * it). At a caret it toggles the stored marks for the next typed text. Code
 * text takes only `link` besides `code`.
 */
export function toggleMark(
  state: EditorState,
  type: Exclude<EditorMarkType, 'link' | 'extension'>,
  options?: EditorTransformOptions
): EditorTransformResult {
  const c = context(options);
  if (state.selection.kind === 'node')
    return fail('not-allowed-here', 'A selected block has no text to mark.');
  if (isCollapsed(state.selection)) {
    const block = textLeaf(state.doc, state.selection.focus.block);
    if (!block || block.type === 'code')
      return fail('not-allowed-here', 'Code blocks take no marks.');
    const base = state.storedMarks ?? inheritedMarks(block.content, state.selection.focus.offset);
    const stored = hasMark(base, type) ? withoutMark(base, type) : withMark(base, { type });
    return { ok: true, state: { ...state, storedMarks: stored } };
  }
  const parts = selectedTexts(state).filter((part) => isRich(part.block) && part.to > part.from);
  const eligible = (marks: readonly { type: string }[]) =>
    type === 'code' || !marks.some((m) => m.type === 'code');
  const runs = parts
    .flatMap(({ block, from, to }) => textRuns((block as EditorRichBlock).content, from, to))
    .filter((run) => eligible(run.marks));
  if (runs.length === 0) return fail('not-allowed-here', 'Nothing selected can take that mark.');
  const remove = runs.every((run) => hasMark(run.marks, type));
  let doc = state.doc;
  for (const { block, from, to } of parts) {
    const rich = block as EditorRichBlock;
    const content = mapMarks(rich.content, from, to, (marks) =>
      !eligible(marks) ? marks : remove ? withoutMark(marks, type) : withMark(marks, { type })
    );
    doc = replaceBlock(doc, block.id, () => [{ ...rich, content }]);
  }
  return done(doc, state.selection, c);
}

/** The extent of the link around `offset`, if any. */
function linkAt(
  content: readonly EditorInline[],
  offset: number
): { from: number; to: number } | null {
  let at = 0;
  const spans: { from: number; to: number; key: string | null }[] = [];
  for (const node of content) {
    const length = node.type === 'text' ? node.text.length : 1;
    const link = node.type === 'text' ? node.marks.find((m) => m.type === 'link') : undefined;
    spans.push({ from: at, to: at + length, key: link ? markKey(link) : null });
    at += length;
  }
  const hit = spans.findIndex(
    (s) =>
      s.key !== null && s.from <= offset && offset <= s.to && (offset < s.to || s.from < offset)
  );
  if (hit === -1) return null;
  const key = spans[hit]?.key;
  let first = hit;
  let last = hit;
  while (spans[first - 1]?.key === key) first -= 1;
  while (spans[last + 1]?.key === key) last += 1;
  return { from: spans[first]?.from ?? 0, to: spans[last]?.to ?? 0 };
}

export interface SetLinkOptions extends EditorTransformOptions {
  /** URL policy tier. Default `untrusted`; pasted and typed URLs stay untrusted. */
  trust?: HrefTrust;
  /** At a caret: insert this text as the link. */
  text?: string;
}

/**
 * Link the selection to `href`, which must pass `safeHref` at `trust`
 * (`untrusted` by default) or the edit is refused. At a caret, updates the
 * link around it, or inserts `options.text` as a new link.
 */
export function setLink(
  state: EditorState,
  href: string,
  options: SetLinkOptions = {}
): EditorTransformResult {
  const c = context(options);
  const safe =
    href.length <= EDITOR_LIMITS.href ? safeHref(href, resolveTrust(options.trust)) : undefined;
  if (!safe) return fail('link-rejected', 'The URL policy refused that link.');
  const link = { type: 'link' as const, href: safe };
  if (state.selection.kind === 'node')
    return fail('not-allowed-here', 'A selected block has no text to link.');
  if (isCollapsed(state.selection)) {
    const { block: id, offset } = state.selection.focus;
    const block = textLeaf(state.doc, id);
    if (!block || block.type === 'code')
      return fail('not-allowed-here', 'Code blocks take no links.');
    if (options.text) {
      return insertText(
        { ...state, storedMarks: withMark(inheritedMarks(block.content, offset), link) },
        options.text,
        options
      );
    }
    const extent = linkAt(block.content, offset);
    if (!extent) return fail('nothing-to-do', 'Select text to link, or pass the link text.');
    const content = mapMarks(block.content, extent.from, extent.to, (marks) =>
      withMark(marks, link)
    );
    return done(
      replaceBlock(state.doc, id, () => [{ ...block, content }]),
      state.selection,
      c
    );
  }
  let doc = state.doc;
  let changed = false;
  for (const { block, from, to } of selectedTexts(state)) {
    if (!isRich(block) || to <= from) continue;
    doc = replaceBlock(doc, block.id, () => [
      { ...block, content: mapMarks(block.content, from, to, (marks) => withMark(marks, link)) },
    ]);
    changed = true;
  }
  return changed
    ? done(doc, state.selection, c)
    : fail('not-allowed-here', 'Nothing selected can take a link.');
}

/** Remove links from the selection, or the whole link around the caret. */
export function removeLink(
  state: EditorState,
  options?: EditorTransformOptions
): EditorTransformResult {
  const c = context(options);
  if (state.selection.kind === 'node')
    return fail('nothing-to-do', 'A selected block has no links.');
  let parts = selectedTexts(state);
  if (isCollapsed(state.selection)) {
    const block = textLeaf(state.doc, state.selection.focus.block);
    const extent =
      block && isRich(block) ? linkAt(block.content, state.selection.focus.offset) : null;
    parts = block && extent ? [{ block, ...extent }] : [];
  }
  let doc = state.doc;
  for (const { block, from, to } of parts) {
    if (!isRich(block)) continue;
    doc = replaceBlock(doc, block.id, () => [
      {
        ...block,
        content: mapMarks(block.content, from, to, (marks) => withoutMark(marks, 'link')),
      },
    ]);
  }
  return doc === state.doc
    ? fail('nothing-to-do', 'There is no link here.')
    : done(doc, state.selection, c);
}

export type EditorVoidInsert = { type: 'divider' } | { type: 'media'; ref: string; alt?: string };

/** Insert a divider or a media reference at the caret; the caret moves to the text after it. */
export function insertBlock(
  state: EditorState,
  insert: EditorVoidInsert,
  options?: EditorTransformOptions
): EditorTransformResult {
  const c = context(options);
  let node: EditorBlock;
  if (insert.type === 'media') {
    const ref = typeof insert.ref === 'string' ? insert.ref.trim() : '';
    if (!ref || ref.length > EDITOR_LIMITS.href) return fail('invalid-shape', 'Media needs a ref.');
    node = { id: c.newId(), type: 'media', ref, alt: cleanText(insert.alt ?? '').text };
  } else node = { id: c.newId(), type: 'divider' };
  const at = prepare(state, c);
  if (!at) return badSelection();
  const { doc, block, offset } = at;
  if (block.type === 'code') return fail('not-allowed-here', 'Blocks cannot go inside code.');
  const location = locateBlock(doc, block.id) as EditorLocation;
  const length = blockLength(block);
  if (length === 0 && block.type === 'paragraph' && !isFirstInItem(location)) {
    return done(
      replaceBlock(doc, block.id, () => [node, block]),
      caret(block.id),
      c
    );
  }
  if (offset === 0 && !isFirstInItem(location))
    return done(
      replaceBlock(doc, block.id, () => [node, block]),
      caret(block.id),
      c
    );
  const tail = paragraph(sliceInline(block.content, offset), c.newId());
  const head = { ...block, content: sliceInline(block.content, 0, offset) };
  return done(
    replaceBlock(doc, block.id, () => [head, node, tail]),
    caret(tail.id),
    c
  );
}

/** A deep copy of blocks with fresh ids. */
function reid(blocks: readonly EditorBlock[], newId: EditorIdSource): EditorBlock[] {
  return blocks.map((block): EditorBlock => {
    if (block.type === 'quote') return { ...block, id: newId(), blocks: reid(block.blocks, newId) };
    if (block.type === 'list') {
      return {
        ...block,
        id: newId(),
        items: block.items.map((item) => ({
          ...item,
          id: newId(),
          blocks: reid(item.blocks, newId),
        })),
      };
    }
    return { ...block, id: newId() };
  });
}

/**
 * Paste: replace the selection with `fragment` (a loaded document or blocks,
 * already sanitized by `loadEditorDocument`, `fromMarkdown` or the paste
 * import). One paragraph pastes inline; several blocks split the caret block
 * around them. Blocks that would nest too deep become plain paragraphs, and
 * blocks past the size caps are cut, each with a diagnostic.
 */
export function replaceSelection(
  state: EditorState,
  fragment: EditorDocument | readonly EditorBlock[],
  options?: EditorTransformOptions
): EditorTransformResult {
  const c = context(options);
  let blocks = reid(
    Array.isArray(fragment)
      ? (fragment as readonly EditorBlock[])
      : (fragment as EditorDocument).blocks,
    c.newId
  );
  const at = prepare(state, c);
  if (!at) return badSelection();
  const { doc, block, offset } = at;
  if (blocks.length === 0) return done(doc, caret(block.id, offset), c);
  const diagnostics: EditorIssue[] = [];
  if (block.type === 'code') {
    const text = editorLeaves({ version: 1, blocks })
      .map(({ block: leaf }) => (isTextBlock(leaf) ? asCode(leaf, 0) : ''))
      .join('\n');
    return insertText({ ...state, selection: caret(block.id, offset), doc }, text, options);
  }
  const first = blocks[0] as EditorBlock;
  if (blocks.length === 1 && isRich(first)) {
    const content = spliceInline(block.content, offset, offset, first.content);
    return done(
      replaceBlock(doc, block.id, () => [{ ...block, content }]),
      caret(block.id, offset + inlineLength(first.content)),
      c
    );
  }
  const location = locateBlock(doc, block.id) as EditorLocation;
  const room = c.limits.depth - location.ancestors.length;
  if (blocks.some((b) => maxDepth([b]) > room)) {
    diagnostics.push({
      code: 'depth-capped',
      message: 'Pasted lists and quotes nested too deep became paragraphs.',
    });
    blocks = blocks.flatMap((b) =>
      maxDepth([b]) > room
        ? editorLeaves({ version: 1, blocks: [b] }).flatMap(({ block: leaf }) =>
            isTextBlock(leaf) ? [paragraph(asInline(leaf, 0), c.newId())] : []
          )
        : [b]
    );
  }
  let head: EditorRichBlock = { ...block, content: sliceInline(block.content, 0, offset) };
  let tail: EditorRichBlock = paragraph(sliceInline(block.content, offset), c.newId());
  let middle = blocks;
  let target = caret(tail.id);
  const firstBlock = middle[0];
  if (firstBlock && isRich(firstBlock)) {
    head = { ...head, content: concatInline(head.content, firstBlock.content) };
    middle = middle.slice(1);
  }
  const lastBlock = middle.at(-1);
  if (lastBlock && isRich(lastBlock)) {
    target = caret(tail.id, inlineLength(lastBlock.content));
    tail = { ...tail, content: concatInline(lastBlock.content, tail.content) };
    middle = middle.slice(0, -1);
  }
  const build = (kept: readonly EditorBlock[]) =>
    replaceBlock(doc, block.id, () => [head, ...kept, tail]);
  let result = done(build(middle), target, c, diagnostics);
  while (!result.ok && middle.length > 0 && result.errors[0]?.code === 'limit-reached') {
    middle = middle.slice(0, -1);
    result = done(build(middle), target, c, [
      ...diagnostics,
      { code: 'limit-reached', message: 'Pasted blocks past the size caps were cut.' },
    ]);
  }
  return result;
}

/**
 * Apply what an input method composed: the block's text as the DOM shows it
 * after `compositionend` (breaks as `\n`) is diffed against the model, and the
 * one changed span is replaced as a single edit.
 */
export function applyComposition(
  state: EditorState,
  blockId: EditorBlockId,
  domText: string,
  options?: EditorTransformOptions
): EditorTransformResult {
  const block = textLeaf(state.doc, blockId);
  if (!block) return badSelection();
  const before = blockText(block);
  let prefix = 0;
  while (prefix < before.length && prefix < domText.length && before[prefix] === domText[prefix])
    prefix += 1;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < domText.length - prefix &&
    before[before.length - 1 - suffix] === domText[domText.length - 1 - suffix]
  )
    suffix += 1;
  const inserted = domText.slice(prefix, domText.length - suffix);
  const selection: EditorSelection = {
    kind: 'text',
    anchor: { block: blockId, offset: prefix },
    focus: { block: blockId, offset: before.length - suffix },
  };
  const next: EditorState = { ...state, selection, storedMarks: null };
  if (inserted === '')
    return isCollapsed(selection)
      ? fail('nothing-to-do', 'The composition changed nothing.')
      : deleteSelection(next, options);
  return insertText(next, inserted, options);
}

/** Move the caret's block (or its list item) one place up or down among its siblings. */
export function moveBlock(
  state: EditorState,
  direction: 'up' | 'down',
  options?: EditorTransformOptions
): EditorTransformResult {
  const c = context(options);
  if (state.selection.kind !== 'text' && state.selection.kind !== 'node') return badSelection();
  const id = state.selection.kind === 'node' ? state.selection.block : state.selection.focus.block;
  const location = locateBlock(state.doc, id);
  if (!location) return badSelection();
  const step = direction === 'up' ? -1 : 1;
  const parent = parentOf(location);
  if (parent?.kind === 'item' && location.index === 0) {
    const { list, itemIndex } = parent;
    const other = itemIndex + step;
    if (other < 0 || other >= list.items.length)
      return fail('nothing-to-do', 'The item is already at the edge of its list.');
    const items = [...list.items];
    [items[itemIndex], items[other]] = [
      items[other] as EditorListItem,
      items[itemIndex] as EditorListItem,
    ];
    return done(
      replaceBlock(state.doc, list.id, () => [{ ...list, items }]),
      state.selection,
      c
    );
  }
  const other = location.index + step;
  if (other < 0 || other >= location.siblings.length || (parent?.kind === 'item' && other === 0)) {
    return fail('nothing-to-do', 'The block is already at the edge of its container.');
  }
  const siblings = [...location.siblings];
  [siblings[location.index], siblings[other]] = [siblings[other] as EditorBlock, location.block];
  return done(withSiblings(state.doc, location, siblings), state.selection, c);
}

export { textLeaf as editorTextBlock };
