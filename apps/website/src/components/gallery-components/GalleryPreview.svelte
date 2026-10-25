<script lang="ts">
/**
 * A gallery card's live preview: the real component in an isolated preview
 * document (its own theme mode, direction and overlays) inside the shared
 * demo frame, plus a props panel and a code sample that follows the props.
 * The preview loads when the card nears the viewport.
 */
import type { Component } from 'svelte';
import { Collapsible } from 'texuli/tabs-accordion';
import DemoFrame from '../live/DemoFrame.svelte';
import IsolatedStage from '../live/IsolatedStage.svelte';
import { formatStageCode } from '../live/props-state.ts';
import { stageFor } from '../live/stage-map.ts';
import type { GalleryComponentCard } from './catalog.ts';

type Props = {
  card: GalleryComponentCard;
};

let { card }: Props = $props();

let values = $state<Record<string, unknown>>({});
let open = $state(false);

$effect.pre(() => {
  values = { ...card.initial };
});

const stage = $derived(stageFor(card.id));
const code = $derived(stage ? formatStageCode(stage, values, card.controls) : '');

function onChange(name: string, value: unknown): void {
  values = { ...values, [name]: value };
}

type PanelProps = {
  schema: GalleryComponentCard['controls'];
  values: Record<string, unknown>;
  code: string;
  onChange: (name: string, value: unknown) => void;
};
/** One shared chunk for every card's panel, loaded on the first open. */
let Panel = $state<Component<PanelProps> | null>(null);
$effect(() => {
  if (!open || Panel) return;
  import('./PanelBody.svelte').then((mod) => {
    Panel = mod.default;
  });
});
</script>

<div class="preview" data-tx-gallery-preview={card.id}>
  <DemoFrame title={`${card.label} preview`}>
    <IsolatedStage
      componentId={card.id}
      {values}
      height={stage?.height ?? 'md'}
      fullPage={stage?.isolate === true}
    />
  </DemoFrame>
  <Collapsible bind:open label={card.controls.length > 0 ? 'Props and code' : 'Code'}>
    {#if open}
      <div class="panel" data-tx-gallery-panel={card.id}>
        {#if Panel}
          <Panel schema={card.controls} {values} {code} {onChange} />
        {:else}
          <p class="loading" role="status">Loading props…</p>
        {/if}
      </div>
    {/if}
  </Collapsible>
</div>

<style>
  .preview {
    display: grid;
    gap: 0.5rem;
    min-inline-size: 0;
  }
  .panel {
    display: grid;
    gap: 0.75rem;
    padding-block-start: 0.5rem;
  }
  .loading {
    margin: 0;
    font-size: 0.875rem;
  }
  .preview :global([data-tx-demo-frame]) {
    margin-block: 0;
  }
  .preview :global([data-tx-demo-stage]) {
    padding: 0;
    overflow: hidden;
  }
</style>
