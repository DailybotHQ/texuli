/**
 * @texuli/canvas/export: a canvas as a static SVG (escaped markup through
 * `@texuli/core/markup`, image URLs through the URL policy) and as a PNG
 * (that SVG rasterized in the browser).
 */
export { canvasToPng, type PngExportOptions } from './png.ts';
export { canvasSvgElement, canvasToSvg, SVG_ELEMENTS, type SvgExportOptions } from './svg.ts';
