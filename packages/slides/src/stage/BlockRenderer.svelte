<script lang="ts">
import type { Block } from '@texuli/blocks/core';
import type { Component } from 'svelte';
import { catalogIdForBlock } from '../grammar/index.ts';
import {
  type DeckBlockRendererProps,
  loadDeckBlockFamily,
  loadedDeckBlockFamily,
} from './loaders.ts';
import { type DeckMediaTrust, deckAvatarResolver, gateDeckMedia } from './media.ts';
import { createDeckTranslator, type DeckTranslate } from './messages.ts';

interface Props {
  block: Block;
  /** URL policy tier for media sources at paint. */
  mediaTrust?: DeckMediaTrust;
  resolveAvatar?: (id: string) => string | undefined;
  /** The deck's current reveal step, for families that step (code highlights). */
  hostStep?: number;
  /** The stage's messages (English defaults when omitted, as in print). */
  t?: DeckTranslate;
}

const english = createDeckTranslator();
let { block, mediaTrust = 'untrusted', resolveAvatar, hostStep, t = english }: Props = $props();
let gate = $derived(gateDeckMedia(block, { trust: mediaTrust, resolveAvatar }));
let avatars = $derived(deckAvatarResolver(resolveAvatar));
// Seeded from the cache so a re-mounted block paints on its first render.
// svelte-ignore state_referenced_locally
let Renderer = $state<Component<DeckBlockRendererProps> | null>(
  loadedDeckBlockFamily(catalogIdForBlock(block.type)) ?? null
);
let failed = $state(false);

$effect(() => {
  let active = true;
  failed = false;
  // A loaded family renders at once: no "Loading" status for screen readers
  // to announce on every slide change.
  const family = catalogIdForBlock(block.type);
  const ready = loadedDeckBlockFamily(family);
  Renderer = ready ?? null;
  if (ready) return;
  void loadDeckBlockFamily(family).then(
    (component) => {
      if (active) Renderer = component;
    },
    () => {
      if (active) failed = true;
    }
  );
  return () => {
    active = false;
  };
});
</script>

{#if !gate.block}
  <p class="tx-deck-stage__media-refused" role="note" data-refused={gate.refused.join(' ')}>
    {t('stage.mediaRefused')}
  </p>
{:else if Renderer}
  {@const LoadedRenderer = Renderer}
  <LoadedRenderer block={gate.block} resolveAvatar={avatars} {hostStep} />
{:else if failed}
  <p class="tx-deck-stage__error" role="alert">{t('layout.contentLoadError')}</p>
{:else}
  <p class="tx-deck-stage__loading" role="status">{t('layout.contentLoading')}</p>
{/if}
