/**
 * Fictional media-lab fixtures. Shape/text compositions need no network.
 * Image demos use same-origin `/media-lab/*` paths (untrusted-safe).
 */

import type { CompositionAnimation } from '@texuli/media/animation';
import { validateComposition } from '@texuli/media/composition-model';
/** Harbor Notes poster — pure shapes + text (exportable offline). */
export const LAB_COMPOSITION = {
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
      text: 'Harbor Notes · media lab',
      paint: { kind: 'solid' as const, color: '#e2e8f0' },
      fontSize: 20,
      fontWeight: 600 as const,
    },
  ],
};

/** Orb travels and recolors in OKLCH (WebM export). */
export const LAB_ANIMATION: CompositionAnimation = {
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

/** Policy demo: javascript: image layer makes exports refuse. */
export const LAB_UNSAFE_COMPOSITION = {
  ...LAB_COMPOSITION,
  layers: [
    ...LAB_COMPOSITION.layers,
    {
      id: 'logo',
      type: 'image' as const,
      frame: { x: 360, y: 160, width: 64, height: 64 },
      src: 'javascript:alert(1)',
      alt: 'Fictional logo',
    },
  ],
};

/** Same-origin illustration for Image / poster (no foreign network). */
export const LAB_IMAGE_SRC = '/media-lab/harbor.svg';
export const LAB_IMAGE_TINY = '/media-lab/harbor-tiny.svg';

export const LAB_CAPTIONS_VTT = `WEBVTT

NOTE Fictional Harbor Notes ferry tour

00:00:00.000 --> 00:00:02.500
Welcome aboard the Harbor Notes ferry.

00:00:02.500 --> 00:00:05.000
Watch the lighthouse on your right.
`;

export const LAB_CHAPTERS_VTT = `WEBVTT

Chapter 1
00:00:00.000 --> 00:00:00.000
Departure

Chapter 2
00:00:30.000 --> 00:00:30.000
Open water
`;

/** Validate lab compositions (unit seam). */
export function labCompositionsAreValid(): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const safe = validateComposition(LAB_COMPOSITION);
  if (!safe.ok) issues.push(...safe.errors.map((e) => e.message));
  const unsafe = validateComposition(LAB_UNSAFE_COMPOSITION);
  // Unsafe image src should fail validation under untrusted default.
  if (unsafe.ok) issues.push('expected unsafe composition to fail validation');
  return { ok: issues.length === 0, issues };
}
