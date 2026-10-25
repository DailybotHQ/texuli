<script lang="ts">
import { type EditorBlock, type EditorInline, inlineToTree } from '@texuli/core/editor-model';
import { type HrefTrust, safeImageSrc } from '@texuli/core/url-policy';
import type { EditorController } from '../controller/controller.svelte.ts';
import Self from './EditorBlock.svelte';
import EditorInlineView from './EditorInline.svelte';
import type { EditorMediaResolver } from './types.ts';

type Props = {
  block: EditorBlock;
  controller: EditorController;
  trust: HrefTrust;
  depth?: number;
  /** The block id of a node selection (a selected divider or media block). */
  selectedBlock: string | null;
  resolveMedia?: EditorMediaResolver | undefined;
  readonly?: boolean;
};

let {
  block,
  controller,
  trust,
  depth = 0,
  selectedBlock,
  resolveMedia,
  readonly = false,
}: Props = $props();

const endsWithBreak = (content: readonly EditorInline[]) => content.at(-1)?.type === 'break';
const media = $derived.by(() => {
  if (block.type !== 'media') return null;
  const resolved = resolveMedia?.(block.ref);
  const src = resolved ? safeImageSrc(resolved.src, 'untrusted') : undefined;
  return src ? { src, alt: resolved?.alt ?? block.alt } : null;
});
const selected = $derived(selectedBlock === block.id);
</script>

{#if block.type === 'paragraph'}
  {#key controller.epoch(block.id)}
    <p class="tx-editor-block tx-editor-paragraph" data-tx-block={block.id} data-depth={depth}>{#if block.content.length === 0}<br data-tx-filler="" />{:else}<EditorInlineView nodes={inlineToTree(block.content)} {trust} />{#if endsWithBreak(block.content)}<br data-tx-filler="" />{/if}{/if}</p>
  {/key}
{:else if block.type === 'heading'}
  {#key controller.epoch(block.id)}
    <svelte:element this={`h${block.level}`} class="tx-editor-block tx-editor-heading" data-level={block.level} data-tx-block={block.id} data-depth={depth}>{#if block.content.length === 0}<br data-tx-filler="" />{:else}<EditorInlineView nodes={inlineToTree(block.content)} {trust} />{#if endsWithBreak(block.content)}<br data-tx-filler="" />{/if}{/if}</svelte:element>
  {/key}
{:else if block.type === 'code'}
  {#key controller.epoch(block.id)}
    <pre class="tx-editor-block tx-editor-pre" data-tx-block={block.id} data-lang={block.lang} data-depth={depth}><code>{block.text}</code>{#if block.text === '' || block.text.endsWith('\n')}<br data-tx-filler="" />{/if}</pre>
  {/key}
{:else if block.type === 'divider'}
  <div class="tx-editor-block tx-editor-void" class:tx-editor-selected={selected} data-tx-void={block.id} contenteditable="false">
    <hr class="tx-editor-divider" />
  </div>
{:else if block.type === 'media'}
  <figure class="tx-editor-block tx-editor-void tx-editor-media" class:tx-editor-selected={selected} data-tx-void={block.id} contenteditable="false">
    {#if media}
      <img class="tx-editor-media-img" src={media.src} alt={media.alt} />
    {:else}
      <span class="tx-editor-media-fallback">{controller.labels.mediaFallback(block.alt)}</span>
    {/if}
  </figure>
{:else if block.type === 'quote'}
  <blockquote class="tx-editor-quote" data-depth={depth}>
    {#each block.blocks as child (child.id)}
      <Self block={child} {controller} {trust} depth={depth + 1} {selectedBlock} {resolveMedia} {readonly} />
    {/each}
  </blockquote>
{:else if block.type === 'list'}
  <svelte:element
    this={block.kind === 'ordered' ? 'ol' : 'ul'}
    class="tx-editor-list"
    data-kind={block.kind}
    data-depth={depth}
    start={block.kind === 'ordered' && block.start !== undefined ? block.start : undefined}
  >
    {#each block.items as item (item.id)}
      <li class="tx-editor-item" data-checked={block.kind === 'todo' ? String(item.checked === true) : undefined}>
        {#if block.kind === 'todo'}
          <span class="tx-editor-check" contenteditable="false" data-tx-skip="">
            <input
              type="checkbox"
              checked={item.checked === true}
              disabled={readonly}
              aria-label={item.checked ? controller.labels.done : controller.labels.notDone}
              onchange={() => {
                const first = item.blocks[0];
                if (first) controller.toggleItem(first.id);
              }}
            />
          </span>
        {/if}
        <div class="tx-editor-item-body">
          {#each item.blocks as child (child.id)}
            <Self block={child} {controller} {trust} depth={depth + 1} {selectedBlock} {resolveMedia} {readonly} />
          {/each}
        </div>
      </li>
    {/each}
  </svelte:element>
{/if}
