<script lang="ts">
// A wrapped block or an embed in a document whose host has a block
// renderer (G111): the host paints what it claims, and what the library
// refuses when it claims the fallback; the library paints the rest. When
// nobody paints a node, the refused notice shows. Loaded lazily.
import type { EmbedBlock, WrappedBlock } from '@texuli/document/model';
import type { DeckPlayerHost } from '@texuli/player';
import type { Component } from 'svelte';
import { blockClaim, readonlyNode } from './block-claim.ts';
import type { PagesBlockPainter } from './block-host.ts';
import type { EmbedResolver } from './embeds.ts';
import HostBlockView from './HostBlockView.svelte';
import type { PagesLabels } from './labels.ts';
import type { PagesPlayerLoader } from './player-loader.ts';

let {
  node,
  views,
  painter,
  labels,
  resolveEmbed,
  deckHost = null,
  reducedMotion = false,
  loadPlayer = null,
}: {
  node: WrappedBlock | EmbedBlock;
  /**
   * The library's views, handed in by the block list (so this lazy chunk
   * shares no module with the reader's and never splits it).
   */
  // biome-ignore lint/suspicious/noExplicitAny: the views' props are checked where they are defined.
  views: { WrappedBlockView: Component<any>; EmbedView: Component<any> };
  painter: PagesBlockPainter;
  labels: PagesLabels;
  resolveEmbed?: EmbedResolver | undefined;
  deckHost?: DeckPlayerHost | null | undefined;
  reducedMotion?: boolean;
  loadPlayer?: PagesPlayerLoader | null | undefined;
} = $props();

const frozen = $derived(readonlyNode(node));
const claim = $derived(blockClaim(painter, frozen));
/** The node the library refused (a new node value starts over). */
let refusedFor = $state.raw<WrappedBlock | EmbedBlock | null>(null);
const host = $derived(claim === 'host' || (claim === 'fallback' && refusedFor === node));
const onrefused = $derived(claim === 'fallback' ? () => (refusedFor = node) : undefined);
const refusedLabel = $derived(node.type === 'block' ? labels.blockRefused : labels.refused);
</script>

{#if host}
  <HostBlockView node={frozen} {painter} {refusedLabel} />
{:else if node.type === 'block'}
  <views.WrappedBlockView {node} {refusedLabel} loadingLabel={labels.embedLoading} {onrefused} />
{:else}
  <views.EmbedView {node} {labels} {resolveEmbed} {deckHost} {reducedMotion} {loadPlayer} {onrefused} />
{/if}
