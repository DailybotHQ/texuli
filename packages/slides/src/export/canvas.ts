/**
 * Export geometry for deck model v2: the virtual canvas of each aspect (the
 * engine's `DECK_CANVAS`, repeated here so the export entry does not load the
 * model), the print page that holds one slide at 96 pixels per inch, and the
 * PPTX slide size in EMU. A print page, a PPTX slide and the stage canvas
 * are the same size, so a slide never rescales between them.
 */
export type DeckExportAspect = '16:9' | '4:3' | '9:16' | '1:1';

export const DECK_EXPORT_CANVAS: Readonly<
  Record<DeckExportAspect, Readonly<{ width: number; height: number }>>
> = Object.freeze({
  '16:9': Object.freeze({ width: 1280, height: 720 }),
  '4:3': Object.freeze({ width: 1024, height: 768 }),
  '9:16': Object.freeze({ width: 720, height: 1280 }),
  '1:1': Object.freeze({ width: 1080, height: 1080 }),
});

/** EMU per canvas pixel: 914400 per inch at 96 pixels per inch. */
export const EMU_PER_CANVAS_PX = 9525;

/** PPTX slide size (EMU) per aspect: the canvas at 96 pixels per inch. */
export const PPTX_CANVAS_SLIDE_SIZES: Readonly<
  Record<DeckExportAspect, Readonly<{ cx: number; cy: number }>>
> = Object.freeze({
  '16:9': Object.freeze({ cx: 1280 * EMU_PER_CANVAS_PX, cy: 720 * EMU_PER_CANVAS_PX }),
  '4:3': Object.freeze({ cx: 1024 * EMU_PER_CANVAS_PX, cy: 768 * EMU_PER_CANVAS_PX }),
  '9:16': Object.freeze({ cx: 720 * EMU_PER_CANVAS_PX, cy: 1280 * EMU_PER_CANVAS_PX }),
  '1:1': Object.freeze({ cx: 1080 * EMU_PER_CANVAS_PX, cy: 1080 * EMU_PER_CANVAS_PX }),
});

export function isDeckExportAspect(value: unknown): value is DeckExportAspect {
  return typeof value === 'string' && Object.hasOwn(DECK_EXPORT_CANVAS, value);
}
