<script lang="ts">
import { AnimationTimeline } from '@texuli/media/timeline';

const composition = {
  version: 2,
  width: 1280,
  height: 720,
  durationMs: 6000,
  layers: [
    {
      id: 'background',
      type: 'shape',
      shape: 'rectangle',
      frame: { x: 0, y: 0, width: 1280, height: 720 },
      fill: { kind: 'solid', color: '#0b1d33' },
    },
    {
      id: 'lower-third',
      type: 'group',
      offset: { x: 48, y: 560 },
      timing: { startMs: 2000 },
      children: [
        {
          id: 'bar',
          type: 'shape',
          shape: 'rectangle',
          frame: { x: 0, y: 0, width: 640, height: 112 },
          fill: { kind: 'solid', color: '#1f6feb' },
        },
        {
          id: 'speaker',
          type: 'group',
          offset: { x: 24, y: 16 },
          opacity: 0.9,
          children: [
            {
              id: 'speaker-name',
              type: 'text',
              text: 'Avery Example',
              paint: { kind: 'solid', color: '#ffffff' },
              fontSize: 36,
              fontWeight: 600,
              frame: { x: 120, y: 0, width: 480, height: 44 },
            },
          ],
        },
      ],
    },
  ],
};

const animation = {
  version: 1,
  durationMs: 6000,
  tracks: [
    {
      layerId: 'lower-third',
      keyframes: [
        { timeMs: 2000, translateX: -640, opacity: 0 },
        { timeMs: 2600, translateX: 48, opacity: 1, easing: 'ease-out' },
      ],
    },
  ],
};

let timeMs = $state(2600);
</script>

<section class="demo" aria-labelledby="timeline-demo-title">
  <h2 id="timeline-demo-title">Lower-third · 6 seconds</h2>
  <p>Select a keyframe, then use the timeline controls to inspect the transition.</p>
  <div dir="rtl" lang="ar">
    <AnimationTimeline
      {composition}
      {animation}
      bind:timeMs
      preview
      title="الخط الزمني للشريط السفلي"
      trust="developer"
    />
  </div>
</section>

<style>
  .demo {
    display: grid;
    gap: 0.75rem;
    inline-size: min(100%, 58rem);
    color: var(--tx-foreground, CanvasText);
  }
  h2,
  p {
    margin: 0;
  }
  p {
    color: var(--tx-muted-foreground, GrayText);
  }
  :global(.tx-animation-timeline__stage svg) {
    direction: ltr;
  }
</style>
