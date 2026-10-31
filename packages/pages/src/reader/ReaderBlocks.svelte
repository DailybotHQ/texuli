<script lang="ts">
// The read-only rendering of a block list: semantic elements, text
// interpolation only, links and images through the URL policy, and the same
// block, embed and page-link views the editor paints.
import type { DocumentBlock } from '@texuli/document/model';
import type { DeckPlayerHost } from '@texuli/player';
import type { PagesBlockPainter } from '../shared/block-host.ts';
import EmbedView from '../shared/EmbedView.svelte';
import type { EmbedResolver } from '../shared/embeds.ts';
import { loadHostSlot } from '../shared/host-slot.ts';
import Inline from '../shared/Inline.svelte';
import type { PagesLabels } from '../shared/labels.ts';
import MediaView from '../shared/MediaView.svelte';
import type { MediaResolver } from '../shared/media.ts';
import PageLinkView from '../shared/PageLinkView.svelte';
import WrappedBlockView from '../shared/WrappedBlockView.svelte';
import Self from './ReaderBlocks.svelte';

interface Props {
  blocks: readonly DocumentBlock[];
  labels: PagesLabels;
  anchors: ReadonlyMap<string, string>;
  /** Added to every heading level (clamped to 6). */
  headingOffset: number;
  resolveEmbed?: EmbedResolver | undefined;
  resolveMedia?: MediaResolver | undefined;
  deckHost?: DeckPlayerHost | null | undefined;
  onNavigate?: ((ref: string) => void) | undefined;
  pageHref?: ((ref: string) => string | null | undefined) | undefined;
  reducedMotion: boolean;
  /** The host's block renderer (G111); without one the host slot never loads. */
  painter?: PagesBlockPainter | null | undefined;
}

let props: Props = $props();
const labels = $derived(props.labels);
const level = (value: number) => `h${Math.min(6, Math.max(1, value + props.headingOffset))}`;
/** The library's views, for the lazy host slot. */
const views = { WrappedBlockView, EmbedView };
</script>

{#each props.blocks as block (block.id)}
  {#if block.type === 'paragraph'}
    <p class="tx-pages-p" data-block-id={block.id}><Inline content={block.content} /></p>
  {:else if block.type === 'heading'}
    <svelte:element this={level(block.level)} class="tx-pages-heading" data-level={block.level} id={props.anchors.get(block.id)} data-block-id={block.id}>
      <Inline content={block.content} />
    </svelte:element>
  {:else if block.type === 'code'}
    <pre class="tx-pages-pre" data-block-id={block.id}><code data-lang={block.lang}>{block.text}</code></pre>
  {:else if block.type === 'list'}
    <svelte:element this={block.kind === 'ordered' ? 'ol' : 'ul'} class="tx-pages-list-view" data-kind={block.kind} start={block.kind === 'ordered' && block.start !== undefined ? block.start : undefined} data-block-id={block.id}>
      {#each block.items as item (item.id)}
        <li data-checked={block.kind === 'todo' ? String(item.checked === true) : undefined}>
          {#if block.kind === 'todo'}
            <span class="tx-pages-check" aria-hidden="true">{item.checked ? '☑' : '☐'}</span>
            <span class="tx-pages-visually-hidden">{item.checked ? labels.done : labels.notDone}</span>
          {/if}
          <Self {...props} blocks={item.blocks} />
        </li>
      {/each}
    </svelte:element>
  {:else if block.type === 'quote'}
    <blockquote class="tx-pages-quote" data-block-id={block.id}><Self {...props} blocks={block.blocks} /></blockquote>
  {:else if block.type === 'divider'}
    <hr class="tx-pages-divider" data-block-id={block.id} />
  {:else if block.type === 'media'}
    <MediaView node={block} resolveMedia={props.resolveMedia} fallback={labels.mediaFallback} />
  {:else if block.type === 'callout'}
    <aside class="tx-pages-callout" data-tone={block.tone} aria-label={block.title || labels.blockType('callout')} data-block-id={block.id}>
      {#if block.title}<p class="tx-pages-callout__heading"><strong>{block.title}</strong></p>{/if}
      <Self {...props} blocks={block.blocks} />
    </aside>
  {:else if block.type === 'toggle'}
    <details class="tx-pages-details" open={block.open === true} data-block-id={block.id}>
      <summary><Inline content={block.summary} /></summary>
      <Self {...props} blocks={block.blocks} />
    </details>
  {:else if block.type === 'columns'}
    <div class="tx-pages-columns" data-block-id={block.id} style:grid-template-columns={block.columns.map((column) => `${column.width ?? 1}fr`).join(' ')}>
      {#each block.columns as column (column.id)}
        <div class="tx-pages-column"><Self {...props} blocks={column.blocks} /></div>
      {/each}
    </div>
  {:else if block.type === 'page-link'}
    <p class="tx-pages-p" data-block-id={block.id}>
      <PageLinkView node={block} label={labels.openPage(block.title)} onNavigate={props.onNavigate} pageHref={props.pageHref} />
    </p>
  {:else if (block.type === 'block' || block.type === 'embed') && props.painter}
    {#await loadHostSlot() then HostSlot}
      <HostSlot node={block} {views} painter={props.painter} {labels} resolveEmbed={props.resolveEmbed} deckHost={props.deckHost} reducedMotion={props.reducedMotion} />
    {:catch}
      <p class="tx-pages-notice" role="note">{block.type === 'block' ? labels.blockRefused : labels.refused}</p>
    {/await}
  {:else if block.type === 'block'}
    <WrappedBlockView node={block} refusedLabel={labels.blockRefused} loadingLabel={labels.embedLoading} />
  {:else if block.type === 'embed'}
    <EmbedView node={block} {labels} resolveEmbed={props.resolveEmbed} deckHost={props.deckHost} reducedMotion={props.reducedMotion} />
  {/if}
{/each}
