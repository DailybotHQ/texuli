<script lang="ts">
// The canvas editor over a fictional retro board. `@texuli/canvas` is not a
// fixture-app dependency (adding one needs the lockfile owner):
// vite.config.ts aliases its export map.
import { CanvasEditor } from '@texuli/canvas/editor';
import { canvasToPng, canvasToSvg } from '@texuli/canvas/export';
import type { CanvasDocument } from '@texuli/canvas/model';
import { onMount } from 'svelte';

const initial: CanvasDocument = {
  format: 'texuli-canvas',
  formatVersion: 1,
  meta: { title: 'Launch retro', locale: 'en' },
  grid: 8,
  shapes: [
    { id: 'start', type: 'ellipse', x: 40, y: 40, width: 144, height: 72, text: 'Feedback' },
    { id: 'triage', type: 'diamond', x: 280, y: 32, width: 128, height: 96, text: 'Urgent?' },
    {
      id: 'note',
      type: 'sticky',
      x: 40,
      y: 200,
      width: 160,
      height: 120,
      text: 'Docs were ready',
      color: 'green',
    },
  ],
  connectors: [{ id: 'c1', from: { shape: 'start' }, to: { shape: 'triage' }, routing: 'elbow' }],
};

let canvas = $state.raw(initial);

onMount(() => {
  (window as unknown as { txCanvas: object }).txCanvas = {
    doc: () => JSON.parse(JSON.stringify(canvas)),
    svg: () => canvasToSvg(canvas),
    png: async () => {
      const blob = await canvasToPng(canvas, { scale: 1 });
      return [...new Uint8Array(await blob.arrayBuffer()).slice(0, 8)];
    },
  };
  const status = document.getElementById('canvas-status');
  if (status) status.textContent = 'Ready';
});
</script>

<div class="canvas-fixture">
  <CanvasEditor bind:canvas />
</div>

<style>
  .canvas-fixture {
    max-inline-size: 72rem;
    min-block-size: 36rem;
  }
</style>
