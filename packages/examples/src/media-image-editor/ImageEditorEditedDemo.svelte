<script lang="ts">
import { ImageEditor } from '@texuli/media/image-editor';
import { validateImageEdit } from '@texuli/media/image-editor/model';
import { harborSceneDataUrl } from './scene.ts';

const src = harborSceneDataUrl(document);
// A saved edit, validated like any stored or agent-written data.
const saved = validateImageEdit({
  version: 1,
  rotate: 0,
  flipX: false,
  flipY: false,
  crop: { x: 0.2, y: 0.25, width: 0.65, height: 0.65 },
  filters: { brightness: 106, contrast: 112, saturation: 125 },
  annotations: [
    {
      id: 'boat',
      type: 'ellipse',
      color: '#ffffff',
      strokeWidth: 0.008,
      frame: { x: 0.28, y: 0.32, width: 0.32, height: 0.45 },
    },
    {
      id: 'pointer',
      type: 'arrow',
      color: '#fde047',
      strokeWidth: 0.01,
      from: { x: 0.85, y: 0.15 },
      to: { x: 0.62, y: 0.35 },
    },
    {
      id: 'label',
      type: 'text',
      color: '#fde047',
      strokeWidth: 0.004,
      at: { x: 0.62, y: 0.06 },
      text: 'Boat 7',
      fontSize: 0.09,
    },
  ],
});
let value = $state(saved.ok ? saved.edit : undefined);
let ready = $state(false);
let exported = $state('');
</script>

{#if !ready}<p role="status">Preparing the example image…</p>{/if}
<div class="demo">
  <ImageEditor
    {src}
    alt="Fishing boat in a harbor at dawn"
    trust="developer"
    bind:value
    onstatus={(status) => (ready = status !== 'loading')}
    onexport={(result) => (exported = result.ok ? `${result.type}, ${result.blob.size} bytes` : result.reason)}
  />
  {#if exported}<p class="note">Last export: {exported}</p>{/if}
</div>

<style>
  .demo {
    max-inline-size: 64rem;
  }
  .note {
    margin-block: 0.75rem 0;
    font-size: 0.875rem;
  }
</style>
