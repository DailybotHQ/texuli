<script lang="ts">
const maxLayers = 256;
const scene = {
  version: 1,
  width: 1200,
  height: 800,
  durationMs: 12_000,
  layers: [
    {
      id: 'background',
      type: 'shape',
      shape: 'rectangle',
      frame: { x: 0, y: 0, width: 1200, height: 800 },
      fill: {
        kind: 'linear-gradient',
        angle: 135,
        stops: [
          { offset: 0, color: '#16324f' },
          { offset: 1, color: '#4c91a8' },
        ],
      },
    },
    {
      id: 'portrait',
      type: 'image',
      frame: { x: 780, y: 110, width: 260, height: 320 },
      transform: { rotateDeg: 3 },
      src: 'https://media.example.test/portrait.webp',
      alt: 'Illustration placeholder for a fictional portrait',
      fit: 'cover',
      mask: { layerId: 'portrait-mask', mode: 'alpha' },
    },
    {
      id: 'portrait-mask',
      type: 'shape',
      shape: 'ellipse',
      frame: { x: 780, y: 110, width: 260, height: 320 },
      fill: { kind: 'solid', color: '#ffffff' },
    },
    {
      id: 'headline',
      type: 'text',
      frame: { x: 100, y: 250, width: 620, height: 120 },
      text: 'A scene, described as data',
      paint: { kind: 'solid', color: '#ffffff' },
      fontSize: 48,
      fontWeight: 700,
      align: 'start',
      blendMode: 'normal',
    },
  ],
} as const;
</script>

<section aria-labelledby="composition-title">
  <h2 id="composition-title">Bounded composition data</h2>
  <p>This 1200 × 800 scene is data: a gradient, masked image, transform and text.</p>
  <p>Validation caps a scene at {maxLayers} layers before a renderer consumes it.</p>
  <pre aria-label="Composition model example">{JSON.stringify(scene, null, 2)}</pre>
</section>
