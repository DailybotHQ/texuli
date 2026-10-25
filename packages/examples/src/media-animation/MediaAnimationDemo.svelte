<script lang="ts">
import { CompositionAnimationPlayer } from '@texuli/media/animation/player';

const composition = {
  version: 1 as const,
  width: 480,
  height: 240,
  layers: [
    {
      id: 'bg',
      type: 'shape' as const,
      shape: 'rectangle' as const,
      frame: { x: 0, y: 0, width: 480, height: 240 },
      fill: {
        kind: 'linear-gradient' as const,
        angle: 120,
        stops: [
          { offset: 0, color: '#0f172a' },
          { offset: 1, color: '#1e3a5f' },
        ],
      },
    },
    {
      id: 'orb',
      type: 'shape' as const,
      shape: 'ellipse' as const,
      frame: { x: 40, y: 70, width: 80, height: 80 },
      fill: { kind: 'solid' as const, color: '#38bdf8' },
      opacity: 1,
    },
    {
      id: 'caption',
      type: 'text' as const,
      frame: { x: 24, y: 40, width: 420, height: 36 },
      text: 'Keyframe motion · example.com fiction',
      paint: { kind: 'solid' as const, color: '#e2e8f0' },
      fontSize: 18,
      fontWeight: 600 as const,
    },
  ],
};

const animation = {
  version: 1 as const,
  durationMs: 2000,
  loop: true,
  tracks: [
    {
      layerId: 'orb',
      keyframes: [
        { timeMs: 0, translateX: 0, opacity: 1, easing: 'linear' as const },
        { timeMs: 1000, translateX: 280, opacity: 0.6, easing: 'ease-in-out' as const },
        { timeMs: 2000, translateX: 0, opacity: 1, easing: 'ease-in-out' as const },
      ],
    },
  ],
};
</script>

<section data-example="media-animation" aria-labelledby="media-animation-title">
  <h2 id="media-animation-title">Composition keyframe animation</h2>
  <p>
    Keyframes and easing on composition layers with a keyboard-operable timeline
    scrubber. Reduced-motion shows a still. Fictional example data only.
  </p>

  <h3>Default (still for stable capture)</h3>
  <div data-axis="default">
    <CompositionAnimationPlayer
      {composition}
      {animation}
      title="Orb animation"
      reducedMotion={true}
      initialTimeMs={0}
    />
  </div>

  <h3>Mid-frame still</h3>
  <div data-axis="mid">
    <CompositionAnimationPlayer
      {composition}
      {animation}
      title="Orb mid frame"
      reducedMotion={true}
      initialTimeMs={1000}
    />
  </div>

  <h3>RTL</h3>
  <div data-axis="rtl" dir="rtl" lang="ar">
    <CompositionAnimationPlayer
      composition={{
        version: 1,
        width: 320,
        height: 120,
        layers: [
          {
            id: 'bg',
            type: 'shape',
            shape: 'rectangle',
            frame: { x: 0, y: 0, width: 320, height: 120 },
            fill: { kind: 'solid', color: '#111827' },
          },
          {
            id: 't',
            type: 'text',
            frame: { x: 16, y: 60, width: 280, height: 40 },
            text: 'حركة مع احترام تقليل الحركة',
            paint: { kind: 'solid', color: '#f9fafb' },
            fontSize: 16,
            align: 'end',
          },
        ],
      }}
      animation={{
        version: 1,
        durationMs: 1000,
        tracks: [
          {
            layerId: 't',
            keyframes: [
              { timeMs: 0, opacity: 0.4 },
              { timeMs: 1000, opacity: 1 },
            ],
          },
        ],
      }}
      title="RTL animation still"
      reducedMotion={true}
    />
  </div>

  <h3>Dark</h3>
  <div data-axis="dark" data-tx-mode="dark" class="dark-panel">
    <CompositionAnimationPlayer
      {composition}
      {animation}
      title="Dark orb still"
      reducedMotion={true}
      initialTimeMs={500}
    />
  </div>
</section>

<style>
  section {
    display: grid;
    gap: 1rem;
    padding: 1rem;
    max-inline-size: 40rem;
  }

  .dark-panel {
    padding: 0.75rem;
    border-radius: var(--tx-radius, 0.5rem);
    background: var(--tx-background, #020617);
    color: var(--tx-foreground, #e2e8f0);
  }
</style>
