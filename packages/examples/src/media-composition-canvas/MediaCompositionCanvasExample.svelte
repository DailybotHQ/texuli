<script lang="ts">
import { CompositionCanvas, type RenderCompositionResult } from '@texuli/media/composition-canvas';
import { harborPoster, hostileScene } from './scenes.ts';

let summary = $state('');

function onrender(result: RenderCompositionResult) {
  summary = result.ok
    ? `${result.report.drawn.length} layers drawn, ${result.report.maskSources.length} used as a mask, ${result.report.culled.length} outside the view.`
    : '';
}
</script>

<section class="example" aria-labelledby="canvas-example-title">
  <h2 id="canvas-example-title">Composition on a canvas</h2>
  <p>
    A 1200 × 800 fictional poster with gradients, a screen blend, a luminance mask, a rotated card
    and 160 generated dots. Zoom in, then pan: layers outside the view are not drawn.
  </p>
  <CompositionCanvas composition={harborPoster} label="Harbor Lights Festival poster" {onrender} />
  <p class="summary" aria-live="polite">{summary}</p>

  <h3>Rejected input</h3>
  <p>The same component refuses a scene whose image uses a <code>javascript:</code> URL.</p>
  <CompositionCanvas composition={hostileScene} label="Rejected scene" />
</section>

<style>
  .example {
    display: grid;
    gap: 0.75rem;
    max-inline-size: 60rem;
  }
  .example h2,
  .example h3,
  .example p {
    margin: 0;
  }
  .summary {
    min-block-size: 1.5em;
  }
</style>
