/**
 * @texuli/canvas/export: a canvas as a static SVG (escaped markup through
 * `@texuli/core/markup`, image URLs through the URL policy) and as a PNG
 * (that SVG rasterized in the browser), in the fixed export palette or in
 * a design system's values (`design`).
 */
export { canvasToPng, type PngExportOptions } from './png.ts';
export {
  type CanvasExportDesign,
  canvasSvgElement,
  canvasToSvg,
  EXPORT_DESIGN_ROLES,
  exportPalette,
  SVG_ELEMENTS,
  type SvgExportOptions,
} from './svg.ts';
