import { blockLength, blockText, editorLeaves, isTextBlock } from './document.ts';
import { snapToGrapheme } from './graphemes.ts';
import type {
  EditorBlock,
  EditorBlockId,
  EditorDocument,
  EditorPoint,
  EditorSelection,
  EditorTextBlock,
} from './types.ts';

/** A collapsed text selection (a caret) at `offset` in `block`. */
export const caret = (block: EditorBlockId, offset = 0): EditorSelection => ({
  kind: 'text',
  anchor: { block, offset },
  focus: { block, offset },
});

/** A text selection from `anchor` to `focus` (either order). */
export const textSelection = (
  anchor: EditorPoint,
  focus: EditorPoint = anchor
): EditorSelection => ({
  kind: 'text',
  anchor,
  focus,
});

/** Select the void block (divider, media) `block`. */
export const nodeSelection = (block: EditorBlockId): EditorSelection => ({ kind: 'node', block });

export const isCollapsed = (selection: EditorSelection): boolean =>
  selection.kind === 'text' &&
  selection.anchor.block === selection.focus.block &&
  selection.anchor.offset === selection.focus.offset;

/** A point in document order: the leaf index, then the offset. */
export interface EditorRangePoint extends EditorPoint {
  index: number;
}

/** The ordered ends of a selection, or `null` when it points outside the document. */
export function selectionRange(
  doc: EditorDocument,
  selection: EditorSelection
): { from: EditorRangePoint; to: EditorRangePoint } | null {
  const leaves = editorLeaves(doc);
  const indexOf = (id: EditorBlockId) => leaves.findIndex(({ block }) => block.id === id);
  if (selection.kind === 'node') {
    const index = indexOf(selection.block);
    if (index === -1) return null;
    const point = { block: selection.block, offset: 0, index };
    return { from: point, to: point };
  }
  const a = { ...selection.anchor, index: indexOf(selection.anchor.block) };
  const f = { ...selection.focus, index: indexOf(selection.focus.block) };
  if (a.index === -1 || f.index === -1) return null;
  const forward = a.index < f.index || (a.index === f.index && a.offset <= f.offset);
  return forward ? { from: a, to: f } : { from: f, to: a };
}

const firstText = (doc: EditorDocument): EditorTextBlock | undefined =>
  editorLeaves(doc).find(({ block }) => isTextBlock(block))?.block as EditorTextBlock | undefined;

function clampPoint(doc: EditorDocument, point: EditorPoint): EditorPoint | null {
  const leaf = editorLeaves(doc).find(({ block }) => block.id === point.block)?.block;
  if (!leaf || !isTextBlock(leaf)) return null;
  const offset = Math.max(0, Math.min(blockLength(leaf), Math.trunc(point.offset) || 0));
  return { block: leaf.id, offset: snapToGrapheme(blockText(leaf), offset) };
}

/**
 * A selection that is valid in `doc`: points inside text blocks, offsets
 * clamped and snapped to grapheme boundaries. A selection on a missing block
 * falls back to the start of the first text block (or the first leaf).
 */
export function clampSelection(doc: EditorDocument, selection: EditorSelection): EditorSelection {
  if (selection.kind === 'node') {
    const leaf = editorLeaves(doc).find(({ block }) => block.id === selection.block)?.block;
    if (leaf && !isTextBlock(leaf)) return selection;
  } else {
    const anchor = clampPoint(doc, selection.anchor);
    const focus = clampPoint(doc, selection.focus);
    if (anchor && focus) {
      const same =
        anchor.offset === selection.anchor.offset && focus.offset === selection.focus.offset;
      return same ? selection : textSelection(anchor, focus);
    }
  }
  return startSelection(doc);
}

/** A caret at the start of the document. */
export function startSelection(doc: EditorDocument): EditorSelection {
  const text = firstText(doc);
  if (text) return caret(text.id);
  const leaf = editorLeaves(doc)[0]?.block as EditorBlock;
  return nodeSelection(leaf.id);
}

/** Select the whole document (first text block start to last text block end). */
export function selectAll(doc: EditorDocument): EditorSelection {
  const texts = editorLeaves(doc)
    .map(({ block }) => block)
    .filter(isTextBlock);
  const first = texts[0];
  const last = texts.at(-1);
  if (!first || !last) return startSelection(doc);
  return textSelection(
    { block: first.id, offset: 0 },
    { block: last.id, offset: blockLength(last) }
  );
}
