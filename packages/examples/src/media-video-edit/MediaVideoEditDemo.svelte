<script lang="ts">
import { type VideoEdit, VideoEditPanel } from '@texuli/media/video';

let edit = $state<VideoEdit>({
  version: 1,
  trim: { startMs: 1_000, endMs: 8_000 },
  captions: [
    { id: 'cue-1', start: 1, end: 3.5, text: 'A calm morning at Port Meridian.' },
    { id: 'cue-2', start: 4, end: 7, text: 'Harbor Notes keeps the field team in sync.' },
  ],
});
</script>

<section class="demo" aria-labelledby="video-edit-title">
  <h2 id="video-edit-title">Port Meridian field note · 10 seconds</h2>
  <p>Caption text is ordinary text and this editing example makes no network requests.</p>
  <VideoEditPanel durationMs={10_000} value={edit} onchange={(next) => (edit = next)} />
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    inline-size: min(100%, 48rem);
    color: var(--tx-foreground, CanvasText);
  }
  h2,
  p {
    margin: 0;
  }
  p {
    color: var(--tx-muted-foreground, GrayText);
  }
</style>
