<script lang="ts">
// One text row: an `@texuli/editor` surface over a one-block editor
// document. Edits come back from the controller and go to the page editor
// as document operations (`commitText`); a change from outside (an undo, a
// remote edit) resyncs the controller and keeps the caret when it can.
import { getAnnouncer } from '@texuli/core/announcer';
import type { EditorDocument, EditorSelection } from '@texuli/core/editor-model';
import type { DocumentBlock, DocumentBlockId } from '@texuli/document/model';
import { equalData } from '@texuli/document/ops';
import { EditorSurface } from '@texuli/editor/editor';
import { untrack } from 'svelte';
import { getPagesContext } from './context.ts';
import { RowController } from './row-controller.ts';
import type { PagesFocusRequest } from './state.svelte.ts';
import { containsId, leafLength, rowEditorDocument, textLeaves } from './text.ts';

let {
  block,
  label,
  placeholder,
  onescape,
}: {
  block: DocumentBlock;
  label: string;
  placeholder?: string | undefined;
  /** Escape in the text: the row selects its block. */
  onescape?: (() => void) | undefined;
} = $props();

const context = getPagesContext();
const editor = context.editor;
let surface: { focus(): void } | undefined = $state();
let root: HTMLDivElement | undefined = $state();
/** The document block this controller last matched. */
let synced: DocumentBlock = untrack(() => block);

function say(message: string): void {
  if (editor.options.announce) editor.options.announce(message);
  else if (typeof document !== 'undefined') getAnnouncer(document).announce(message, 'polite');
}

function commit(doc: EditorDocument): void {
  const next = editor.commitText(block.id, doc.blocks, controller.state.selection);
  if (next) synced = next;
  else resync(block, null);
}

const controller = new RowController(
  {
    doc: untrack(() => rowEditorDocument(block)),
    newId: () => editor.newId(),
    trust: 'untrusted',
    announce: say,
    onChange: commit,
  },
  {
    undo: () => editor.undo(),
    redo: () => editor.redo(),
    slash: () => {
      if (context.readonly()) return false;
      editor.openSlash(block.id, true);
      return true;
    },
    joinBackward: () => editor.mergeBackward(block.id),
    joinForward: () => editor.mergeForward(block.id),
  }
);

/** Put the controller back on the document's block, keeping the caret when its block survives. */
function resync(current: DocumentBlock, selection: EditorSelection | null): void {
  controller.replace(rowEditorDocument(current));
  if (selection && selection.kind === 'text' && containsId(current, selection.focus.block))
    controller.select(selection);
}

// Document → controller: a change that did not come from this controller.
$effect(() => {
  const current = block;
  untrack(() => {
    if (current === synced) return;
    synced = current;
    const blocks = controller.doc.blocks;
    if (blocks.length === 1 && equalData(blocks[0], current)) return;
    resync(current, controller.state.selection);
  });
});

/** Focus the text at a request's leaf and offset, or at its start or end. */
export function focusAt(request: Pick<PagesFocusRequest, 'leaf' | 'offset' | 'edge'>): void {
  if (block !== synced) {
    synced = block;
    resync(block, null);
  }
  const leaves = textLeaves(block);
  const leaf =
    request.leaf && containsId(block, request.leaf)
      ? request.leaf
      : request.edge === 'end'
        ? leaves.last
        : leaves.first;
  if (leaf) {
    const offset = request.offset ?? (request.edge === 'end' ? leafLength(block, leaf) : 0);
    const point = { block: leaf, offset };
    controller.select({ kind: 'text', anchor: point, focus: point });
  }
  surface?.focus();
}

/** True when the caret sits on the first (or last) visual line of the row. */
function onEdgeLine(edge: 'start' | 'end'): boolean {
  const selection = document.getSelection();
  if (!root || !selection || selection.rangeCount === 0) return true;
  const range = selection.getRangeAt(0);
  const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
  const leafId = edge === 'start' ? textLeaves(block).first : textLeaves(block).last;
  const leaf = leafId ? root.querySelector(`[data-tx-block="${CSS.escape(leafId)}"]`) : null;
  if (!leaf || !rect || (rect.width === 0 && rect.height === 0 && rect.top === 0)) return true;
  const box = leaf.getBoundingClientRect();
  const line = Math.max(rect.height, 1);
  return edge === 'start'
    ? rect.top - box.top < line * 0.75
    : box.bottom - rect.bottom < line * 0.75;
}

function inEdgeLeaf(edge: 'start' | 'end'): boolean {
  const selection = controller.state.selection;
  if (selection.kind !== 'text') return false;
  const leaves = textLeaves(block);
  return selection.focus.block === (edge === 'start' ? leaves.first : leaves.last);
}

function onkeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented || event.isComposing || controller.composing) return;
  const { key, altKey, ctrlKey, metaKey, shiftKey } = event;
  if (altKey && !ctrlKey && !metaKey && (key === 'ArrowUp' || key === 'ArrowDown')) {
    event.preventDefault();
    if (context.readonly()) return;
    const selection = controller.state.selection;
    if (editor.moveBy(block.id, key === 'ArrowUp' ? -1 : 1) && selection.kind === 'text')
      editor.requestFocus(block.id, {
        leaf: selection.focus.block,
        offset: selection.focus.offset,
      });
    return;
  }
  if (key === 'Escape') {
    event.preventDefault();
    onescape?.();
    return;
  }
  if (altKey || ctrlKey || metaKey || shiftKey) return;
  const rtl = root ? getComputedStyle(root).direction === 'rtl' : false;
  const back = key === 'ArrowUp' || key === (rtl ? 'ArrowRight' : 'ArrowLeft');
  const forward = key === 'ArrowDown' || key === (rtl ? 'ArrowLeft' : 'ArrowRight');
  if (!back && !forward) return;
  const vertical = key === 'ArrowUp' || key === 'ArrowDown';
  const edge = back ? 'start' : 'end';
  const atEdge = vertical
    ? inEdgeLeaf(edge) && onEdgeLine(edge)
    : controller.caretAt(edge) || (inEdgeLeaf(edge) && caretAtLeafEdge(edge));
  if (atEdge && editor.navigate(block.id, back ? -1 : 1)) event.preventDefault();
}

/** Keys the row handles around the surface (an attachment: the wrapper is not interactive itself). */
function keys(node: HTMLElement): () => void {
  node.addEventListener('keydown', onkeydown);
  return () => node.removeEventListener('keydown', onkeydown);
}

function caretAtLeafEdge(edge: 'start' | 'end'): boolean {
  const selection = controller.state.selection;
  if (selection.kind !== 'text') return false;
  const { anchor, focus } = selection;
  if (anchor.block !== focus.block || anchor.offset !== focus.offset) return false;
  return edge === 'start' ? focus.offset === 0 : focus.offset === leafLength(block, focus.block);
}
</script>

<div class="tx-pages-text" data-block-type={block.type} bind:this={root} {@attach keys}>
  <EditorSurface
    bind:this={surface}
    {controller}
    {label}
    {placeholder}
    readonly={context.readonly()}
    trust="untrusted"
    resolveMedia={context.resolveMedia}
  />
</div>
