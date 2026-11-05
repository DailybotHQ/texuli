<script lang="ts">
import { Button } from 'texuli/button';
import { MotionLoop } from 'texuli/motion/loop';

let playing = $state(true);
</script>

<section data-example="texuli-motion-loop" aria-labelledby="motion-loop-demo-title">
  <h2 id="motion-loop-demo-title">Looping motion</h2>

  <h3>Voice note</h3>
  <div class="note">
    <MotionLoop preset="wave" {playing} stagger="fast" class="waveform" aria-hidden="true">
      <span class="bar bar-1"></span>
      <span class="bar bar-2"></span>
      <span class="bar bar-3"></span>
      <span class="bar bar-4"></span>
      <span class="bar bar-5"></span>
    </MotionLoop>
    <p class="status" role="status">{playing ? 'Playing: Harbor standup note' : 'Paused'}</p>
    <Button variant="outline" size="sm" aria-pressed={playing} onclick={() => (playing = !playing)}>
      {playing ? 'Pause' : 'Play'}
    </Button>
  </div>

  <h3>Live indicator</h3>
  <p class="live">
    <MotionLoop preset="pulse" aria-hidden="true"><span class="dot"></span></MotionLoop>
    Ada Example is speaking
  </p>
</section>

<style>
  .note {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--tx-space-4);
  }

  .note :global(.waveform) {
    display: inline-flex;
    align-items: center;
    gap: var(--tx-space-1);
    block-size: var(--tx-space-8);
  }

  .bar {
    display: block;
    inline-size: var(--tx-space-1);
    border-radius: var(--tx-shape-radius-full);
    background-color: var(--tx-primary);
  }

  .bar-1,
  .bar-5 {
    block-size: 40%;
  }

  .bar-2,
  .bar-4 {
    block-size: 75%;
  }

  .bar-3 {
    block-size: 100%;
  }

  .status {
    margin: 0;
    color: var(--tx-muted-foreground);
  }

  .live {
    display: flex;
    align-items: center;
    gap: var(--tx-space-2);
  }

  .dot {
    display: block;
    inline-size: var(--tx-space-3);
    block-size: var(--tx-space-3);
    border-radius: var(--tx-shape-radius-full);
    background-color: var(--tx-success);
  }
</style>
