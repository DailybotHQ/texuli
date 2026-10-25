<script lang="ts">
import { CompositionSvg } from '@texuli/media/composition-svg';

const scene = {
  version: 1 as const,
  width: 640,
  height: 360,
  layers: [
    {
      id: 'bg',
      type: 'shape' as const,
      shape: 'rectangle' as const,
      frame: { x: 0, y: 0, width: 640, height: 360 },
      fill: {
        kind: 'linear-gradient' as const,
        angle: 135,
        stops: [
          { offset: 0, color: '#16324f' },
          { offset: 1, color: '#4c91a8' },
        ],
      },
    },
    {
      id: 'accent',
      type: 'shape' as const,
      shape: 'ellipse' as const,
      frame: { x: 420, y: 40, width: 180, height: 180 },
      fill: { kind: 'solid' as const, color: '#ffffff33' },
      blendMode: 'screen' as const,
    },
    {
      id: 'headline',
      type: 'text' as const,
      frame: { x: 40, y: 140, width: 400, height: 80 },
      text: 'A scene as data → SVG',
      paint: { kind: 'solid' as const, color: '#ffffff' },
      fontSize: 32,
      fontWeight: 700 as const,
      align: 'start' as const,
    },
    {
      id: 'caption',
      type: 'text' as const,
      frame: { x: 40, y: 220, width: 400, height: 40 },
      text: 'Text stays text. example.com fiction only.',
      paint: { kind: 'solid' as const, color: '#dcecf2' },
      fontSize: 16,
      align: 'start' as const,
    },
  ],
};

const hostile = {
  version: 1 as const,
  width: 320,
  height: 120,
  layers: [
    {
      id: 't',
      type: 'text' as const,
      frame: { x: 12, y: 48, width: 296, height: 40 },
      text: '<img src=x onerror=alert(1)>',
      paint: { kind: 'solid' as const, color: '#111111' },
      fontSize: 14,
    },
  ],
};
</script>

<section data-example="media-composition-svg" aria-labelledby="media-svg-title">
  <h2 id="media-svg-title">Composition → SVG</h2>
  <p>
    Validated composition data renders to an accessible SVG. Text layers stay
    real text. Unsafe image URLs are rejected.
  </p>

  <h3>Default scene</h3>
  <div data-axis="default" class="frame">
    <CompositionSvg composition={scene} title="Fictional gradient scene" />
  </div>

  <h3>Hostile text stays text</h3>
  <div data-axis="escape" class="frame light">
    <CompositionSvg composition={hostile} title="Escaped text sample" trust="untrusted" />
  </div>

  <h3>RTL</h3>
  <div data-axis="rtl" class="frame" dir="rtl" lang="ar">
    <CompositionSvg
      composition={{
        version: 1,
        width: 400,
        height: 120,
        layers: [
          {
            id: 'bg',
            type: 'shape',
            shape: 'rectangle',
            frame: { x: 0, y: 0, width: 400, height: 120 },
            fill: { kind: 'solid', color: '#0f172a' },
          },
          {
            id: 'ar',
            type: 'text',
            frame: { x: 20, y: 60, width: 360, height: 40 },
            text: 'نص يبقى نصاً',
            paint: { kind: 'solid', color: '#f8fafc' },
            fontSize: 22,
            align: 'end',
          },
        ],
      }}
      title="RTL composition"
    />
  </div>

  <h3>Dark</h3>
  <div data-axis="dark" class="frame dark" data-tx-mode="dark">
    <CompositionSvg
      composition={{
        version: 1,
        width: 400,
        height: 160,
        layers: [
          {
            id: 'bg',
            type: 'shape',
            shape: 'rectangle',
            frame: { x: 0, y: 0, width: 400, height: 160 },
            fill: { kind: 'solid', color: '#020617' },
          },
          {
            id: 't',
            type: 'text',
            frame: { x: 24, y: 80, width: 350, height: 40 },
            text: 'Dark panel composition',
            paint: { kind: 'solid', color: '#e2e8f0' },
            fontSize: 20,
          },
        ],
      }}
      title="Dark composition"
    />
  </div>
</section>

<style>
  section {
    display: grid;
    gap: 1rem;
    padding: 1rem;
    max-inline-size: 48rem;
  }

  .frame {
    overflow: auto;
    border: 1px solid var(--tx-border, #cbd5e1);
    border-radius: var(--tx-radius, 0.5rem);
    padding: 0.5rem;
    background: var(--tx-surface, #fff);
  }

  .frame.light {
    background: #f8fafc;
  }

  .frame.dark {
    background: #020617;
    color: #e2e8f0;
  }
</style>
