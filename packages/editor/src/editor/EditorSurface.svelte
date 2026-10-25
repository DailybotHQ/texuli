<script lang="ts">
import { createEditorKeymap, intentFromInputType } from '@texuli/core/editor-keymap';
import { detectPlatform } from '@texuli/core/keyboard';
import type { HrefTrust } from '@texuli/core/url-policy';
import type { EditorController } from '../controller/controller.svelte.ts';
import {
  BLOCK_ATTR,
  blockElementOf,
  domBlockText,
  domToPoint,
  readDomSelection,
  sameSelection,
  VOID_ATTR,
  writeDomSelection,
} from './dom.ts';
import EditorBlock from './EditorBlock.svelte';
import type { EditorMediaResolver } from './types.ts';
import './editor.css';

type Props = {
  controller: EditorController;
  id?: string;
  /** The accessible name, when no visible label names the editor. */
  label?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  placeholder?: string;
  readonly?: boolean;
  /** Tier for rendering link hrefs (they were checked on the way in; this re-checks them). */
  trust?: HrefTrust;
  resolveMedia?: EditorMediaResolver;
  /** Mod+K: the host opens its link dialog. */
  onLinkRequest?: () => void;
  class?: string;
};

let {
  controller,
  id,
  label,
  'aria-labelledby': labelledby,
  'aria-describedby': describedby,
  placeholder,
  readonly = false,
  trust = 'untrusted',
  resolveMedia,
  onLinkRequest,
  class: className,
}: Props = $props();

let root: HTMLDivElement | null = $state(null);
let focused = $state(false);
/** The block the input method writes into, captured at `compositionstart`. */
let composingBlock: Element | null = null;
/** A block the browser changed with an input we could not cancel. */
let dirtyBlock: Element | null = null;

const keymap = createEditorKeymap(
  detectPlatform(typeof navigator === 'undefined' ? null : navigator)
);
const selection = $derived(controller.state.selection);
const selectedBlock = $derived(selection.kind === 'node' ? selection.block : null);
const empty = $derived.by(() => {
  const blocks = controller.doc.blocks;
  const first = blocks[0];
  return blocks.length === 1 && first?.type === 'paragraph' && first.content.length === 0;
});

/** Focus the surface and put the DOM selection back where the model has it. */
export function focus(): void {
  root?.focus({ preventScroll: true });
  if (root) writeDomSelection(root, controller.state.selection, document.getSelection());
}

// Model → DOM: after each render, while focused and not composing.
$effect(() => {
  const current = controller.state.selection;
  void controller.doc;
  if (!root || !focused || controller.composing) return;
  writeDomSelection(root, current, document.getSelection());
});

// DOM → model: native caret movement, clicks and selection handles.
$effect(() => {
  const onSelectionChange = () => {
    if (!root || controller.composing) return;
    const read = readDomSelection(root, document.getSelection());
    if (read && !sameSelection(read, controller.state.selection)) controller.select(read);
  };
  document.addEventListener('selectionchange', onSelectionChange);
  return () => document.removeEventListener('selectionchange', onSelectionChange);
});

function blockOfSelection(): Element | null {
  const current = document.getSelection();
  return root && current?.anchorNode ? blockElementOf(root, current.anchorNode) : null;
}

/** The text range an input event targets (spellcheck and autocorrect replacements). */
function targetSelection(event: InputEvent) {
  const range = event.getTargetRanges?.()[0];
  if (!root || !range) return null;
  const anchor = domToPoint(root, range.startContainer, range.startOffset);
  const focusPoint = domToPoint(root, range.endContainer, range.endOffset);
  return anchor && focusPoint ? { kind: 'text' as const, anchor, focus: focusPoint } : null;
}

function onbeforeinput(event: InputEvent) {
  if (readonly) {
    event.preventDefault();
    return;
  }
  const intent = intentFromInputType(event.inputType);
  if (intent === 'composition' || controller.composing) return;
  if (!event.cancelable) {
    dirtyBlock = blockOfSelection();
    return;
  }
  event.preventDefault();
  if (intent === null || intent === 'paste' || intent === 'drop') return;
  if (intent === 'insert-text' || intent === 'replace-text') {
    const target = targetSelection(event);
    if (target && !sameSelection(target, controller.state.selection)) controller.select(target);
  }
  const data = event.data ?? event.dataTransfer?.getData('text/plain') ?? null;
  controller.runInput(intent, data);
}

function oninput() {
  if (controller.composing || !dirtyBlock) return;
  const id = dirtyBlock.getAttribute(BLOCK_ATTR);
  if (id !== null) controller.syncFromDom(id, domBlockText(dirtyBlock));
  dirtyBlock = null;
}

function oncompositionstart() {
  if (readonly) return;
  composingBlock = blockOfSelection();
  controller.compositionStart();
}

function oncompositionend() {
  const block = composingBlock;
  composingBlock = null;
  const id = block?.getAttribute(BLOCK_ATTR) ?? null;
  controller.compositionEnd(id, block && id !== null ? domBlockText(block) : null);
}

function onkeydown(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229 || controller.composing) return;
  const intent = keymap.match(event);
  if (!intent) {
    if (event.key !== 'Tab') controller.tabLeaves = false;
    return;
  }
  if (readonly && intent !== 'escape') return;
  if (intent === 'link') {
    event.preventDefault();
    onLinkRequest?.();
    return;
  }
  if (controller.runKey(intent)) event.preventDefault();
}

function onpaste(event: ClipboardEvent) {
  event.preventDefault();
  if (readonly || !event.clipboardData) return;
  controller.paste(event.clipboardData);
}

function ondrop(event: DragEvent) {
  // Dropped content would bypass the paste import; it is refused for now.
  event.preventDefault();
}

function onclick(event: MouseEvent) {
  const target = event.target as Element | null;
  const link = target?.closest?.('a.tx-editor-link') as HTMLAnchorElement | null;
  if (link) {
    event.preventDefault();
    if ((event.metaKey || event.ctrlKey) && link.href)
      window.open(link.href, '_blank', 'noopener,noreferrer');
    return;
  }
  const voidBlock = target?.closest?.(`[${VOID_ATTR}]`);
  const voidId = voidBlock?.getAttribute(VOID_ATTR);
  if (voidId && !readonly) controller.select({ kind: 'node', block: voidId });
}
</script>

<div
  bind:this={root}
  {id}
  class={['tx-editor-surface', className]}
  role="textbox"
  aria-multiline="true"
  aria-label={labelledby ? undefined : (label ?? controller.labels.textbox)}
  aria-labelledby={labelledby}
  aria-describedby={describedby}
  aria-readonly={readonly ? 'true' : undefined}
  contenteditable={readonly ? 'false' : 'true'}
  tabindex="0"
  spellcheck="true"
  translate="no"
  data-empty={empty ? '' : undefined}
  data-placeholder={placeholder}
  onfocus={() => (focused = true)}
  onblur={() => (focused = false)}
  {onbeforeinput}
  {oninput}
  {oncompositionstart}
  {oncompositionend}
  {onkeydown}
  {onpaste}
  {ondrop}
  {onclick}
>
  {#each controller.doc.blocks as block (block.id)}
    <EditorBlock {block} {controller} {trust} {selectedBlock} {resolveMedia} {readonly} />
  {/each}
</div>
