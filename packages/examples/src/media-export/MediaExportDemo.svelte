<script lang="ts">
import { sampleComposition } from '@texuli/media/animation';
import { CompositionCanvas } from '@texuli/media/composition-canvas';
import { CompositionExport } from '@texuli/media/export/ui';
import { EXPORT_ANIMATION, EXPORT_COMPOSITION, UNSAFE_COMPOSITION } from './samples.ts';

// The animation's middle frame: the orb halfway across, its fill mixed in OKLCH.
const middle = sampleComposition(EXPORT_COMPOSITION, EXPORT_ANIMATION, 500);
</script>

<section class="demo" data-example="media-export" aria-labelledby="media-export-title">
  <h2 id="media-export-title">Export to PNG, SVG and WebM</h2>
  <p>
    Files are made in the browser: PNG from the canvas renderer, SVG from the SVG renderer, and
    WebM by recording sampled frames. Nothing is uploaded. Fictional example data only.
  </p>

  <h3>Animated poster (middle frame)</h3>
  <CompositionCanvas composition={middle} label="Harbor poster, frame at 0.5 seconds" />
  <CompositionExport
    composition={EXPORT_COMPOSITION}
    animation={EXPORT_ANIMATION}
    filename="harbor-poster"
    title="Harbor poster"
    background="#0f172a"
  />

  <h3>Unsafe image source</h3>
  <p>
    This composition has an image with a <code>javascript:</code> source. The media URL policy
    refuses it, so every export explains the problem instead of making a file.
  </p>
  <CompositionExport
    composition={UNSAFE_COMPOSITION}
    filename="unsafe"
    labels={{ group: 'Export the unsafe composition' }}
  />
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    max-inline-size: 42rem;
    padding: 1.5rem;
  }
  .demo h2,
  .demo h3,
  .demo p {
    margin: 0;
  }
</style>
