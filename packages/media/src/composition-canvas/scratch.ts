import type { CompositionContext2D, ScratchSurface } from './draw.ts';

/** The 2D context of a canvas, or `null` when the platform has none. */
export function asContext(value: unknown): CompositionContext2D | null {
  return value && typeof value === 'object' && 'fillRect' in value
    ? (value as CompositionContext2D)
    : null;
}

/** Scratch surfaces from `OffscreenCanvas` when the platform has it, else detached canvases. */
export function defaultScratchFactory(
  documentRef?: Document
): (width: number, height: number) => ScratchSurface | null {
  return (width, height) => {
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const context = asContext(canvas.getContext('2d'));
      return context ? { context, image: canvas } : null;
    }
    const canvas = documentRef?.createElement('canvas');
    if (!canvas) return null;
    canvas.width = width;
    canvas.height = height;
    const context = asContext(canvas.getContext('2d'));
    return context ? { context, image: canvas } : null;
  };
}
