<script lang="ts">
import { getAnnouncer } from '@texuli/core/announcer';
import { createEditorKeymap } from '@texuli/core/editor-keymap';
import type { EditorDocument, EditorLimits } from '@texuli/core/editor-model';
import { detectPlatform } from '@texuli/core/keyboard';
import type { HrefTrust } from '@texuli/core/url-policy';
import { untrack } from 'svelte';
import { EditorController } from '../controller/controller.svelte.ts';
import type { EditorLabels } from '../controller/labels.ts';
import LinkDialog from '../link-dialog/LinkDialog.svelte';
import EditorToolbar from '../toolbar/EditorToolbar.svelte';
import EditorSurface from './EditorSurface.svelte';
import type { EditorMediaResolver } from './types.ts';
import './editor.css';

type Props = {
  /**
   * The document (validated: `loadEditorDocument` or `fromMarkdown` from
   * `@texuli/core`). A new value from outside restarts history; the editor's
   * own edits arrive through `onChange` (keep them in `$state.raw`).
   */
  value?: EditorDocument;
  /** Bring your own headless controller instead (its options win). */
  controller?: EditorController;
  /** URL policy tier for links typed in the link dialog. Default `untrusted`. */
  trust?: HrefTrust;
  limits?: Partial<EditorLimits>;
  labels?: Partial<EditorLabels>;
  id?: string;
  label?: string;
  'aria-labelledby'?: string;
  placeholder?: string;
  readonly?: boolean;
  /** Show the formatting toolbar (default true). */
  toolbar?: boolean;
  resolveMedia?: EditorMediaResolver;
  onChange?: (doc: EditorDocument) => void;
  class?: string;
};

let {
  value,
  controller: external,
  trust = 'untrusted',
  limits,
  labels,
  id,
  label,
  'aria-labelledby': labelledby,
  placeholder,
  readonly = false,
  toolbar = true,
  resolveMedia,
  onChange,
  class: className,
}: Props = $props();

const uid = $props.id();
const helpId = `${uid}-help`;

/** The last document exchanged through `value`, so the editor's own changes never loop back. */
let exchanged: EditorDocument | undefined = untrack(() => value);

// Created once: later prop changes reach it through `replace` (value) only.
const editor = untrack(
  () =>
    external ??
    new EditorController({
      ...(value ? { doc: value } : {}),
      trust,
      ...(limits ? { limits } : {}),
      ...(labels ? { labels } : {}),
      announce: (message) => {
        if (typeof document !== 'undefined') getAnnouncer(document).announce(message, 'polite');
      },
      onChange: (doc) => {
        exchanged = doc;
        onChange?.(doc);
      },
    })
);

// A document set from outside (not one the editor produced) restarts history.
$effect(() => {
  if (!value || value === exchanged) return;
  exchanged = value;
  untrack(() => editor.replace(value as EditorDocument));
});

const keymap = createEditorKeymap(
  detectPlatform(typeof navigator === 'undefined' ? null : navigator)
);
const help = $derived(
  editor.labels.help({
    bold: keymap.describe('toggle-strong')[0] ?? '',
    italic: keymap.describe('toggle-em')[0] ?? '',
    link: keymap.describe('link')[0] ?? '',
    undo: keymap.describe('undo')[0] ?? '',
  })
);

let surface: EditorSurface | null = $state(null);
let linkOpen = $state(false);

function backToText() {
  surface?.focus();
}

function openLink() {
  if (readonly) return;
  const block = editor.active.block?.type;
  if (block === 'paragraph' || block === 'heading') linkOpen = true;
}

function closeLink() {
  linkOpen = false;
  backToText();
}
</script>

<div class={['tx-editor', className]} data-readonly={readonly ? '' : undefined}>
  {#if toolbar && !readonly}
    <EditorToolbar controller={editor} onCommand={backToText} onLinkRequest={openLink} />
  {/if}
  {#if linkOpen}
    <LinkDialog controller={editor} onClose={closeLink} />
  {/if}
  <EditorSurface
    bind:this={surface}
    controller={editor}
    {id}
    {label}
    aria-labelledby={labelledby}
    aria-describedby={helpId}
    {placeholder}
    {readonly}
    {trust}
    {resolveMedia}
    onLinkRequest={openLink}
  />
  <span class="tx-editor-help" id={helpId}>{help}</span>
</div>
