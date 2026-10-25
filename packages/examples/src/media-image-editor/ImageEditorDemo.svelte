<script lang="ts">
import type { ImageEdit } from '@texuli/media/image-editor';
import { ImageEditor } from '@texuli/media/image-editor';
import { harborSceneDataUrl } from './scene.ts';

// The scene is drawn here, so the data URL is app-authored: developer trust.
const src = harborSceneDataUrl(document);
let edit: ImageEdit | undefined = $state();
let ready = $state(false);
</script>

{#if !ready}<p role="status">Preparing the example image…</p>{/if}
<div class="demo">
  <ImageEditor
    {src}
    alt="Fishing boat in a harbor at dawn, beside a wooden pier"
    trust="developer"
    bind:value={edit}
    onstatus={(status) => (ready = status !== 'loading')}
  />
</div>

<style>
  .demo {
    max-inline-size: 64rem;
  }
</style>
