/**
 * Fictional scenes for the canvas renderer example. Plain data: the renderer
 * validates it like any untrusted input. Dot positions come from the layer
 * index only, so every render (and every visual baseline) is identical.
 */

const DOTS = Array.from({ length: 160 }, (_, i) => {
  const column = i % 20;
  const row = Math.floor(i / 20);
  const size = 6 + ((i * 7) % 9);
  return {
    id: `dot-${i}`,
    type: 'shape',
    shape: 'ellipse',
    frame: {
      x: 40 + column * 56 + ((row * 17) % 23),
      y: 470 + row * 38,
      width: size,
      height: size,
    },
    fill: { kind: 'solid', color: i % 3 === 0 ? '#f6d365' : '#9be7ff' },
    opacity: 0.35 + ((i * 13) % 50) / 100,
  };
});

export const harborPoster = {
  version: 1,
  width: 1200,
  height: 800,
  layers: [
    {
      id: 'sky',
      type: 'shape',
      shape: 'rectangle',
      frame: { x: 0, y: 0, width: 1200, height: 800 },
      fill: {
        kind: 'linear-gradient',
        angle: 160,
        stops: [
          { offset: 0, color: '#0b1d3a' },
          { offset: 1, color: '#2b6c8f' },
        ],
      },
    },
    {
      id: 'glow',
      type: 'shape',
      shape: 'ellipse',
      frame: { x: 640, y: 80, width: 460, height: 460 },
      fill: {
        kind: 'radial-gradient',
        center: { x: 0.5, y: 0.5 },
        radius: 0.5,
        stops: [
          { offset: 0, color: '#ffd27a' },
          { offset: 1, color: '#ffd27a00' },
        ],
      },
      blendMode: 'screen',
    },
    {
      id: 'card',
      type: 'shape',
      shape: 'rectangle',
      frame: { x: 90, y: 170, width: 560, height: 230 },
      transform: { rotateDeg: -3 },
      fill: { kind: 'solid', color: '#0b1d3acc' },
      stroke: { kind: 'solid', color: '#9be7ff' },
      strokeWidth: 2,
    },
    {
      id: 'headline',
      type: 'text',
      frame: { x: 120, y: 200, width: 500, height: 120 },
      transform: { rotateDeg: -3 },
      text: 'Harbor Lights Festival',
      paint: { kind: 'solid', color: '#ffffff' },
      fontSize: 52,
      fontWeight: 700,
    },
    {
      id: 'dates',
      type: 'text',
      frame: { x: 120, y: 330, width: 500, height: 40 },
      transform: { rotateDeg: -3 },
      text: 'Three fictional nights on the east pier',
      paint: { kind: 'solid', color: '#cfe9f5' },
      fontSize: 24,
    },
    {
      id: 'sun',
      type: 'shape',
      shape: 'ellipse',
      frame: { x: 760, y: 200, width: 220, height: 220 },
      fill: { kind: 'solid', color: '#ffb347' },
      mask: { layerId: 'sun-fade', mode: 'luminance' },
    },
    {
      id: 'sun-fade',
      type: 'shape',
      shape: 'rectangle',
      frame: { x: 760, y: 200, width: 220, height: 220 },
      fill: {
        kind: 'linear-gradient',
        angle: 180,
        stops: [
          { offset: 0.35, color: '#ffffff' },
          { offset: 1, color: '#000000' },
        ],
      },
    },
    {
      id: 'horizon',
      type: 'shape',
      shape: 'line',
      frame: { x: 0, y: 440, width: 1200, height: 1 },
      stroke: { kind: 'solid', color: '#9be7ff' },
      strokeWidth: 3,
      opacity: 0.8,
    },
    ...DOTS,
  ],
};

/** Hostile input: an executable URL and markup in text. It must be refused before drawing. */
export const hostileScene = {
  version: 1,
  width: 400,
  height: 200,
  layers: [
    {
      id: 'tracker',
      type: 'image',
      frame: { x: 0, y: 0, width: 400, height: 200 },
      src: 'javascript:alert(document.cookie)',
      alt: '',
    },
  ],
};
