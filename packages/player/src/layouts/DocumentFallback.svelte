<script lang="ts">
// A `document` node painted without a document host (spec 0.7.0). Validation
// refuses such a node, so only an invalid draft previewed with placeholders
// reaches this: it shows the document's title as text and says where the
// document opens. It never reads the blocks.
import { getPlayerLabels } from '../context.ts';

let { doc, label }: { doc?: unknown; label?: string } = $props();

const labels = getPlayerLabels();
const title = $derived.by(() => {
  if (typeof label === 'string' && label.trim()) return label;
  const meta =
    doc && typeof doc === 'object' ? (doc as { meta?: { title?: unknown } }).meta : undefined;
  return typeof meta?.title === 'string' ? meta.title : '';
});
</script>

<article class="tx-player-document" aria-label={title || undefined} data-tx-player-document-fallback>
  {#if title}<p class="tx-player-document__title">{title}</p>{/if}
  <p class="tx-player-document__note">{labels().documentNeedsHost}</p>
</article>
