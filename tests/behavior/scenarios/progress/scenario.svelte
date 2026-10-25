<script lang="ts">
// Progress scenario: @texuli/primitives Progress public API only.
// Relative path keeps the fixture's Vite resolve stable for workspace packages
// imported from outside tests/fixtures/app.
import { Progress } from '../../../../packages/primitives/src/progress/index.ts';

let value = $state<number | null>(40);
</script>

<span id="upload-label">Upload</span>
<Progress.Root {value} max={100} aria-labelledby="upload-label" class="behavior-progress" />
<button type="button" onclick={() => (value = 70)}>Advance upload</button>
<button type="button" onclick={() => (value = null)}>Unknown progress</button>

<style>
  :global(.behavior-progress) {
    display: block;
    block-size: 0.5rem;
    background: color-mix(in srgb, CanvasText 20%, Canvas);
  }
</style>
