/**
 * PNG export: the SVG export rasterized on a canvas element (browser only).
 * The SVG goes through an object URL into an image, never into markup.
 * Images on other origins taint the canvas, so the browser refuses to
 * encode it: resolve images to same-origin or `data:` URLs for PNG export.
 */
import type { CanvasDocument } from '../model/types.ts';
import { canvasToSvg, type SvgExportOptions } from './svg.ts';

export interface PngExportOptions extends SvgExportOptions {
  /** Device pixels per world unit (default 2, at most 4). */
  scale?: number;
  /** Largest width or height in pixels (default 8,192). */
  maxPixels?: number;
}

/** Rasterize a canvas to a PNG blob. Rejects outside a browser or when encoding fails. */
export async function canvasToPng(
  doc: CanvasDocument,
  options: PngExportOptions = {}
): Promise<Blob> {
  if (typeof document === 'undefined' || typeof Image === 'undefined' || typeof URL === 'undefined')
    throw new TypeError('PNG export needs a browser.');
  const svg = canvasToSvg(doc, options);
  const size = /viewBox="[^"]*?(-?[\d.]+) (-?[\d.]+)"/.exec(svg);
  const width = Number(size?.[1] ?? 1);
  const height = Number(size?.[2] ?? 1);
  const max = options.maxPixels ?? 8_192;
  const scale = Math.min(
    Math.max(0.1, Math.min(4, options.scale ?? 2)),
    max / Math.max(1, width),
    max / Math.max(1, height)
  );
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.decoding = 'async';
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('The SVG could not be loaded.'));
    });
    image.src = url;
    await loaded;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No 2D canvas context.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed.'))),
        'image/png'
      )
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
