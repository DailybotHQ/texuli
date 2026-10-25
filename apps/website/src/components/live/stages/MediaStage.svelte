<!-- Lazily loaded: carry the styles with the component (Astro attaches lazily
     imported component CSS only to some pages). -->
<svelte:options css="injected" />

<script lang="ts">
/**
 * Image with a local fixture, and a layered composition rendered as SVG or
 * on a canvas. Nothing loads from the network.
 */
import { CompositionCanvas } from '@texuli/media/composition-canvas';
import { validateComposition } from '@texuli/media/composition-model';
import { CompositionSvg } from '@texuli/media/composition-svg';
import { Image } from '@texuli/media/image';
import harbor from '../assets/harbor.png?inline';
import { readers, type StageValues } from './values.ts';

type Props = { componentId: string; values: StageValues };

let { componentId, values }: Props = $props();

const { str, pick } = readers(() => values);

const POSTER = {
  version: 1 as const,
  width: 320,
  height: 180,
  layers: [
    {
      id: 'sky',
      type: 'shape' as const,
      shape: 'rectangle' as const,
      frame: { x: 0, y: 0, width: 320, height: 180 },
      fill: { kind: 'solid' as const, color: '#0f172a' },
    },
    {
      id: 'sun',
      type: 'shape' as const,
      shape: 'ellipse' as const,
      frame: { x: 220, y: 40, width: 60, height: 60 },
      fill: { kind: 'solid' as const, color: '#fbbf24' },
    },
    {
      id: 'sea',
      type: 'shape' as const,
      shape: 'rectangle' as const,
      frame: { x: 0, y: 120, width: 320, height: 60 },
      fill: { kind: 'solid' as const, color: '#1e3a5f' },
    },
    {
      id: 'title',
      type: 'text' as const,
      frame: { x: 20, y: 24, width: 280, height: 30 },
      text: 'Harbor Notes',
      paint: { kind: 'solid' as const, color: '#f8fafc' },
      fontSize: 22,
      fontWeight: 600 as const,
    },
  ],
};

const checked = validateComposition(POSTER);
const composition = checked.ok ? checked.composition : null;
</script>

<div class="media" data-tx-media-stage={componentId}>
  {#if componentId === 'media-image'}
    <Image
      src={harbor}
      alt={str('alt', 'A sailboat on a calm harbor at sunset, beside a wooden pier')}
      width={320}
      height={180}
      fit={pick('fit', ['cover', 'contain', 'fill', 'none', 'scale-down'] as const, 'cover')}
      loading="eager"
      trust="developer"
    />
  {:else if !composition}
    <p role="alert">The composition is invalid.</p>
  {:else if componentId === 'media-composition-svg'}
    <CompositionSvg
      {composition}
      title={str('title', 'Harbor Notes poster')}
      description={str('description', 'A sun over the sea with the product name.')}
    />
  {:else}
    <CompositionCanvas {composition} label={str('label', 'Harbor Notes poster on a canvas')} />
  {/if}
</div>

<style>
  .media {
    display: grid;
    max-inline-size: 22rem;
  }
</style>
