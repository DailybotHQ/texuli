<script lang="ts">
// A `canvas` node painted without a canvas host (spec 0.8.0). Validation
// refuses such a node, so only an invalid draft previewed with placeholders
// reaches this: it shows the canvas title as text and says where the canvas
// opens. It never reads the shapes.
import { getPlayerLabels } from '../context.ts';

let { canvas, label }: { canvas?: unknown; label?: string } = $props();

const labels = getPlayerLabels();
const title = $derived.by(() => {
  if (typeof label === 'string' && label.trim()) return label;
  const meta =
    canvas && typeof canvas === 'object'
      ? (canvas as { meta?: { title?: unknown } }).meta
      : undefined;
  return typeof meta?.title === 'string' ? meta.title : '';
});
</script>

<figure class="tx-player-canvas" aria-label={title || undefined} data-tx-player-canvas-fallback>
  {#if title}<p class="tx-player-canvas__title">{title}</p>{/if}
  <p class="tx-player-canvas__note">{labels().canvasNeedsHost}</p>
</figure>
