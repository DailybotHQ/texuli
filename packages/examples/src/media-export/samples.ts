/** Media export samples (T-media-export). Fictional example.com content only. */

export const EXPORT_COMPOSITION = {
  version: 1 as const,
  width: 480,
  height: 240,
  layers: [
    {
      id: 'bg',
      type: 'shape' as const,
      shape: 'rectangle' as const,
      frame: { x: 0, y: 0, width: 480, height: 240 },
      fill: { kind: 'solid' as const, color: '#0f172a' },
    },
    {
      id: 'orb',
      type: 'shape' as const,
      shape: 'ellipse' as const,
      frame: { x: 40, y: 80, width: 80, height: 80 },
      fill: { kind: 'solid' as const, color: '#38bdf8' },
      stroke: { kind: 'solid' as const, color: '#e2e8f0' },
      strokeWidth: 3,
    },
    {
      id: 'caption',
      type: 'text' as const,
      frame: { x: 24, y: 32, width: 432, height: 32 },
      text: 'Harbor Notes · fictional poster',
      paint: { kind: 'solid' as const, color: '#e2e8f0' },
      fontSize: 20,
      fontWeight: 600 as const,
    },
  ],
};

/** The orb moves right and back while its fill turns from sky blue to coral (OKLCH). */
export const EXPORT_ANIMATION = {
  version: 1 as const,
  durationMs: 2000,
  loop: true,
  tracks: [
    {
      layerId: 'orb',
      keyframes: [
        { timeMs: 0, translateX: 0, fill: '#38bdf8' },
        {
          timeMs: 1000,
          translateX: 300,
          fill: '#f97316',
          stroke: '#fde68a',
          easing: 'ease-in-out' as const,
        },
        {
          timeMs: 2000,
          translateX: 0,
          fill: '#38bdf8',
          stroke: '#e2e8f0',
          easing: 'ease-in-out' as const,
        },
      ],
    },
  ],
};

/** An image layer whose source the media URL policy refuses: exports say why and make no file. */
export const UNSAFE_COMPOSITION = {
  ...EXPORT_COMPOSITION,
  layers: [
    ...EXPORT_COMPOSITION.layers,
    {
      id: 'logo',
      type: 'image' as const,
      frame: { x: 360, y: 160, width: 64, height: 64 },
      src: 'javascript:alert(1)',
      alt: 'Fictional logo',
    },
  ],
};
