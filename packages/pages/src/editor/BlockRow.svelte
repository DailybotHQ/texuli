<script lang="ts">
// One block of a block list: a drag handle (the block's keyboard home: it
// selects the block, picks it up, moves it with Alt+Up/Down and removes it
// with Delete), an insert button, and the block itself.
import type { DocumentBlock, DocumentBlockId } from '@texuli/document/model';
import { Sortable } from '@texuli/primitives/sortable';
import { untrack } from 'svelte';
import EmbedView from '../shared/EmbedView.svelte';
import MediaView from '../shared/MediaView.svelte';
import PageLinkView from '../shared/PageLinkView.svelte';
import WrappedBlockView from '../shared/WrappedBlockView.svelte';
import BlockList from './BlockList.svelte';
import ColumnsRow from './ColumnsRow.svelte';
import { getPagesContext } from './context.ts';
import { loadSlashMenu } from './lazy.ts';
import SummaryField from './SummaryField.svelte';
import TextRow from './TextRow.svelte';
import { isTextRow } from './text.ts';

let { block, parent }: { block: DocumentBlock; parent: DocumentBlockId | null } = $props();

const context = getPagesContext();
const editor = context.editor;
const labels = $derived(editor.labels);
const text = $derived(isTextRow(block));
const name = $derived(editor.nameOf(block));
const selected = $derived(editor.selected === block.id);
const slash = $derived(editor.slash?.anchor === block.id ? editor.slash : null);
const uid = $props.id();
let handle = $state<HTMLElement | null>(null);
let textRow: { focusAt(request: object): void } | undefined = $state();

// Focus requests addressed to this row (after a split, an insert, an undo, a move).
$effect(() => {
  const request = editor.focus;
  if (!request || request.id !== block.id) return;
  // Wait for the row's parts to mount (a row a split just created).
  const row = textRow;
  const button = handle;
  if (text ? !row : !button) return;
  untrack(() => {
    if (text && row) row.focusAt(request);
    else button?.focus({ preventScroll: false });
    editor.focused(request.seq);
  });
});

function selectAndFocusHandle(): void {
  editor.select(block.id);
  handle?.focus();
}

function onhandlekeydown(event: KeyboardEvent): void {
  const dragging = (event.currentTarget as HTMLElement).hasAttribute('data-dragging');
  if (dragging) return;
  const { key, altKey, ctrlKey, metaKey } = event;
  if (altKey && !ctrlKey && !metaKey && (key === 'ArrowUp' || key === 'ArrowDown')) {
    event.preventDefault();
    if (context.readonly()) return;
    if (editor.moveBy(block.id, key === 'ArrowUp' ? -1 : 1)) {
      editor.select(block.id);
      editor.requestFocus(block.id, {});
    }
    return;
  }
  if (altKey || ctrlKey || metaKey) return;
  if ((key === 'Delete' || key === 'Backspace') && !context.readonly()) {
    event.preventDefault();
    editor.remove(block.id);
  } else if (key === 'Escape') {
    event.preventDefault();
    editor.select(null);
    if (text) editor.requestFocus(block.id, { edge: 'end' });
  } else if (key === 'ArrowUp' || key === 'ArrowDown') {
    event.preventDefault();
    editor.select(null);
    editor.navigate(block.id, key === 'ArrowUp' ? -1 : 1);
  }
}

function toggleOpen(): void {
  if (block.type !== 'toggle' || context.readonly()) return;
  editor.setAttrs(block.id, { open: block.open === false });
}

function onCalloutTitle(event: Event & { currentTarget: HTMLInputElement }): void {
  const value = event.currentTarget.value;
  editor.setAttrs(block.id, { title: value ? value : null }, `title:${block.id}`);
}

const placeholder = $derived(
  block.type === 'paragraph' && block.content.length === 0 ? labels.slashFilter : undefined
);
</script>

<Sortable.Item
  id={block.id}
  label={name}
  as="div"
  class="tx-pages-row"
  data-block-type={block.type}
  data-block-id={block.id}
  data-block-selected={selected ? "" : undefined}
>
  <div class="tx-pages-row__gutter">
    {#if !context.readonly()}
      <button
        type="button"
        class="tx-pages-row__add"
        tabindex="-1"
        aria-label={labels.insertBelow}
        onclick={() => editor.openSlash(block.id, false)}
      ><span aria-hidden="true">+</span></button>
    {/if}
    <Sortable.Handle
      class="tx-pages-row__handle"
      bind:ref={handle}
      tabindex={text ? -1 : 0}
      aria-describedby={context.helpId}
      onclick={() => editor.select(block.id)}
      onkeydown={onhandlekeydown}
      onfocus={() => editor.select(block.id)}
      onblur={() => editor.selected === block.id && editor.select(null)}
    ><span aria-hidden="true">⠿</span></Sortable.Handle>
  </div>
  <div class="tx-pages-row__body">
    {#if text}
      <TextRow
        bind:this={textRow}
        {block}
        label={labels.textRow(editor.typeLabel(block))}
        {placeholder}
        onescape={selectAndFocusHandle}
      />
    {:else if block.type === 'divider'}
      <hr class="tx-pages-divider" />
    {:else if block.type === 'media'}
      <MediaView node={block} resolveMedia={context.resolveMedia} fallback={labels.mediaFallback} />
    {:else if block.type === 'callout'}
      <aside class="tx-pages-callout" data-tone={block.tone} aria-label={block.title || labels.blockType('callout')}>
        <input
          class="tx-pages-callout__title"
          type="text"
          value={block.title ?? ''}
          aria-label={labels.calloutTitle}
          placeholder={labels.calloutTitle}
          readonly={context.readonly()}
          oninput={onCalloutTitle}
        />
        <BlockList parent={block.id} blocks={block.blocks} label={labels.blockType('callout')} />
      </aside>
    {:else if block.type === 'toggle'}
      <div class="tx-pages-toggle" data-open={block.open !== false ? '' : undefined}>
        <div class="tx-pages-toggle__summary">
          <button
            type="button"
            class="tx-pages-toggle__button"
            aria-expanded={block.open !== false}
            aria-controls={`${uid}-toggle`}
            aria-label={labels.blockType('toggle')}
            onclick={toggleOpen}
          ><span aria-hidden="true">▸</span></button>
          <SummaryField {block} label={labels.toggleSummary} />
        </div>
        <div id={`${uid}-toggle`} class="tx-pages-toggle__body" hidden={block.open === false}>
          {#if block.open !== false}
            <BlockList parent={block.id} blocks={block.blocks} label={labels.blockType('toggle')} />
          {/if}
        </div>
      </div>
    {:else if block.type === 'quote'}
      <blockquote class="tx-pages-quote">
        <BlockList parent={block.id} blocks={block.blocks} label={labels.blockType('quote')} />
      </blockquote>
    {:else if block.type === 'columns'}
      <ColumnsRow {block} />
    {:else if block.type === 'page-link'}
      <PageLinkView
        node={block}
        label={labels.openPage(block.title)}
        onNavigate={context.onNavigate}
        pageHref={context.pageHref}
      />
    {:else if block.type === 'block'}
      <WrappedBlockView node={block} refusedLabel={labels.blockRefused} loadingLabel={labels.embedLoading} />
    {:else if block.type === 'embed'}
      <EmbedView
        node={block}
        {labels}
        resolveEmbed={context.resolveEmbed}
        deckHost={context.deckHost}
        reducedMotion={context.motion() === false}
      />
    {/if}
  </div>
  {#if slash}
    {#await loadSlashMenu() then SlashMenu}
      <SlashMenu request={slash} />
    {/await}
  {/if}
</Sortable.Item>
