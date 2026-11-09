## Install

Svelte 5 (`^5.57.2`) is a peer. Import the token stylesheet once.

```bash
npm install @texuli/canvas
```

```ts
import '@texuli/tokens/base.css';
```

## Load and edit

Canvases from a file, an agent or a share link go through `loadUntrustedCanvas` first. Keep the document in `$state.raw`.

```svelte
<script lang="ts">
  import { CanvasEditor } from '@texuli/canvas/editor';
  import { loadUntrustedCanvas } from '@texuli/canvas/model';
  import '@texuli/tokens/base.css';

  let { json }: { json: string } = $props();
  const loaded = loadUntrustedCanvas(json);
  let canvas = $state.raw(loaded.ok ? loaded.canvas : null);
</script>

{#if canvas}
  <CanvasEditor bind:canvas resolveImage={(ref) => `https://cdn.example.com/${ref}.png`} />
{/if}
```

## Build from operations

```ts
import { applyCanvasOps, createCanvas, moveOps } from '@texuli/canvas/model';

const canvas = createCanvas({ title: 'Launch plan' });
const added = applyCanvasOps(canvas, [
  { op: 'add', shape: { id: 'a', type: 'sticky', x: 0, y: 0, width: 160, height: 160, text: 'Ship' } },
]);
```
