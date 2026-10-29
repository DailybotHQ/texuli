<script lang="ts">
// One text row: an `@texuli/editor` surface over a one-block editor
// document. Edits come back from the controller and go to the page editor
// as document operations (`commitText`); a change from outside (an undo, a
// remote edit) resyncs the controller and keeps the caret, moved through
// the text the change inserted or removed before it.
import { getAnnouncer } from '@texuli/core/announcer';
import type { EditorDocument, EditorSelection } from '@texuli/core/editor-model';
import type { DocumentBlock, DocumentBlockId } from '@texuli/document/model';
import { equalData } from '@texuli/document/ops';
import {
  EditorSurface,
  readDomSelection,
  sameSelection,
  writeDomSelection,
} from '@texuli/editor/editor';
import { tick, untrack } from 'svelte';
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
/** The op log entry the controller last matched (carets map through later external entries). */
let seen = untrack(() => editor.lastSeq());

function say(message: string): void {
  if (editor.options.announce) editor.options.announce(message);
  else if (typeof document !== 'undefined') getAnnouncer(document).announce(message, 'polite');
}

/** The last input type, so a correction keeps the caret on the side the edit went. */
let lastInput = '';
/** Which side of text inserted at the caret the next resync keeps it on. */
let bias: 'before' | 'after' = 'before';

function commit(doc: EditorDocument): void {
  const before = editor.lastSeq();
  const next = editor.commitText(block.id, doc.blocks, controller.state.selection);
  if (!next) {
    resync(block, null);
    seen = editor.lastSeq();
    return;
  }
  if (editor.lastSeq() > before + 1) {
    // A synced session answered the edit with corrections (suggestion mode
    // keeps struck text visible). `synced` stays on the old block, so the
    // effect below resyncs once this input is done, the caret moved through
    // the corrections only (Backspace lands before struck text, Delete after).
    seen = before + 1;
    bias = lastInput === 'deleteContentForward' ? 'after' : 'before';
    return;
  }
  synced = next;
  seen = editor.lastSeq();
}

/** A caret or selection moved through the external edits applied since `seen`. */
function mapped(selection: EditorSelection, bias: 'before' | 'after' = 'before'): EditorSelection {
  if (selection.kind !== 'text') return selection;
  return {
    kind: 'text',
    anchor: editor.mapPoint(selection.anchor, seen, bias),
    focus: editor.mapPoint(selection.focus, seen, bias),
  };
}

/**
 * Bring the controller's selection up to the DOM's before the surface acts:
 * a key pressed right after a click or a caret move can arrive before the
 * `selectionchange` that would tell it, and Backspace would then join rows
 * from a stale caret.
 */
function syncSelection(): void {
  if (!root || controller.composing) return;
  const read = readDomSelection(root, document.getSelection());
  if (read && !sameSelection(read, controller.state.selection)) controller.select(read);
}

/** Keys and input types reach the row before the surface handles them (an attachment). */
function inputs(node: HTMLElement): () => void {
  const onbeforeinput = (event: Event) => {
    lastInput = (event as InputEvent).inputType ?? '';
    syncSelection();
  };
  node.addEventListener('beforeinput', onbeforeinput, { capture: true });
  node.addEventListener('keydown', syncSelection, { capture: true });
  return () => {
    node.removeEventListener('beforeinput', onbeforeinput, { capture: true });
    node.removeEventListener('keydown', syncSelection, { capture: true });
  };
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
  if (selection && selection.kind === 'text' && containsId(current, selection.focus.block)) {
    controller.select(selection);
    // Rewriting a text node collapses a live DOM caret in it to its start;
    // once the surface has rendered the new text, put the caret back.
    if (root?.contains(document.activeElement))
      tick().then(() => {
        if (root?.contains(document.activeElement))
          writeDomSelection(root, controller.state.selection, document.getSelection());
      });
  }
}

// Document → controller: a change that did not come from this controller.
$effect(() => {
  const current = block;
  untrack(() => {
    if (current === synced) return;
    synced = current;
    const blocks = controller.doc.blocks;
    if (blocks.length === 1 && equalData(blocks[0], current)) {
      seen = editor.lastSeq();
      return;
    }
    resync(current, mapped(controller.state.selection, bias));
    bias = 'before';
    seen = editor.lastSeq();
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

<div class="tx-pages-text" data-block-type={block.type} bind:this={root} {@attach keys} {@attach inputs}>
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
