import { FILTER_NAMES, FILTER_RANGES } from './model.ts';
import type { AnnotationType, FilterName, ImageEdit, SourceSize } from './types.ts';

/** Every visible or announced string of the image editor. `{name}` placeholders are filled in. */
export interface ImageEditorLabels {
  editor: string;
  preview: string;
  loading: string;
  blocked: string;
  unavailable: string;
  transform: string;
  rotateLeft: string;
  rotateRight: string;
  flipX: string;
  flipY: string;
  crop: string;
  cropAspect: string;
  cropAspectFree: string;
  cropAspectSquare: string;
  cropAspectLandscape: string;
  cropAspectPortrait: string;
  cropEdit: string;
  cropDone: string;
  cropReset: string;
  cropArea: string;
  cropHint: string;
  cropX: string;
  cropY: string;
  cropWidth: string;
  cropHeight: string;
  resize: string;
  resizeWidth: string;
  resizeHeight: string;
  keepAspect: string;
  resizeReset: string;
  adjust: string;
  resetFilters: string;
  filters: Record<FilterName, string>;
  annotate: string;
  add: Record<AnnotationType, string>;
  types: Record<AnnotationType, string>;
  annotationName: string;
  annotationList: string;
  noAnnotations: string;
  annotationHint: string;
  color: string;
  colors: readonly string[];
  text: string;
  defaultText: string;
  remove: string;
  history: string;
  undo: string;
  redo: string;
  reset: string;
  export: string;
  exportFormat: string;
  exportButton: string;
  exported: string;
  exportTainted: string;
  exportUnsupported: string;
  summaryNone: string;
  summaryRotate: string;
  summaryFlipX: string;
  summaryFlipY: string;
  summaryCrop: string;
  summarySize: string;
  summaryFilters: string;
  summaryAnnotations: string;
}

export const DEFAULT_IMAGE_EDITOR_LABELS: Readonly<ImageEditorLabels> = Object.freeze({
  editor: 'Image editor',
  preview: 'Edited image',
  loading: 'Loading image…',
  blocked: 'This image source is not allowed.',
  unavailable: 'This image could not be loaded.',
  transform: 'Rotate and flip',
  rotateLeft: 'Rotate left',
  rotateRight: 'Rotate right',
  flipX: 'Flip horizontally',
  flipY: 'Flip vertically',
  crop: 'Crop',
  cropAspect: 'Crop aspect ratio',
  cropAspectFree: 'Free',
  cropAspectSquare: 'Square (1:1)',
  cropAspectLandscape: 'Landscape (16:9)',
  cropAspectPortrait: 'Portrait (9:16)',
  cropEdit: 'Edit crop',
  cropDone: 'Done cropping',
  cropReset: 'Remove crop',
  cropArea: 'Crop area: {x}% from the left, {y}% from the top, {width}% wide, {height}% high',
  cropHint: 'Arrow keys move the crop area. Shift with an arrow key resizes it.',
  cropX: 'Left (%)',
  cropY: 'Top (%)',
  cropWidth: 'Width (%)',
  cropHeight: 'Height (%)',
  resize: 'Resize',
  resizeWidth: 'Width (px)',
  resizeHeight: 'Height (px)',
  keepAspect: 'Keep aspect ratio',
  resizeReset: 'Original size',
  adjust: 'Adjust',
  resetFilters: 'Reset adjustments',
  filters: Object.freeze({
    brightness: 'Brightness',
    contrast: 'Contrast',
    saturation: 'Saturation',
    grayscale: 'Grayscale',
    sepia: 'Sepia',
    hueRotate: 'Hue',
    blur: 'Blur',
  }),
  annotate: 'Annotate',
  add: Object.freeze({
    rect: 'Add rectangle',
    ellipse: 'Add ellipse',
    arrow: 'Add arrow',
    text: 'Add text',
  }),
  types: Object.freeze({ rect: 'Rectangle', ellipse: 'Ellipse', arrow: 'Arrow', text: 'Text' }),
  annotationName: '{type} {index}',
  annotationList: 'Annotations',
  noAnnotations: 'No annotations yet.',
  annotationHint:
    'Arrow keys move the selected annotation. Shift with an arrow key moves it further. Delete removes it.',
  color: 'Color',
  colors: Object.freeze(['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Violet', 'Black', 'White']),
  text: 'Text',
  defaultText: 'Note',
  remove: 'Remove',
  history: 'History',
  undo: 'Undo',
  redo: 'Redo',
  reset: 'Reset all edits',
  export: 'Export',
  exportFormat: 'Format',
  exportButton: 'Export image',
  exported: 'Exported a {width} × {height} image.',
  exportTainted: 'This image cannot be exported: its server does not allow reading its pixels.',
  exportUnsupported: 'This browser cannot export the image.',
  summaryNone: 'No edits.',
  summaryRotate: 'rotated {degrees}°',
  summaryFlipX: 'flipped horizontally',
  summaryFlipY: 'flipped vertically',
  summaryCrop: 'cropped',
  summarySize: '{width} × {height} pixels',
  summaryFilters: '{count} adjustments',
  summaryAnnotations: '{count} annotations',
});

/** Merges translations over the defaults; nested records merge key by key. */
export function resolveImageEditorLabels(
  overrides: Partial<Omit<ImageEditorLabels, 'filters' | 'add' | 'types'>> & {
    filters?: Partial<ImageEditorLabels['filters']>;
    add?: Partial<ImageEditorLabels['add']>;
    types?: Partial<ImageEditorLabels['types']>;
  } = {}
): ImageEditorLabels {
  const pick = <T extends Record<string, string>>(base: T, extra: Partial<T> | undefined): T =>
    Object.fromEntries(
      Object.entries(base).map(([key, value]) => {
        const next = extra?.[key as keyof T];
        return [key, typeof next === 'string' ? next : value];
      })
    ) as T;
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(DEFAULT_IMAGE_EDITOR_LABELS)) {
    const next = (overrides as Record<string, unknown>)[key];
    if (typeof value === 'string') merged[key] = typeof next === 'string' ? next : value;
  }
  const colors =
    Array.isArray(overrides.colors) && overrides.colors.every((c) => typeof c === 'string')
      ? overrides.colors
      : DEFAULT_IMAGE_EDITOR_LABELS.colors;
  return {
    ...(merged as Omit<ImageEditorLabels, 'filters' | 'add' | 'types' | 'colors'>),
    colors,
    filters: pick(DEFAULT_IMAGE_EDITOR_LABELS.filters, overrides.filters),
    add: pick(DEFAULT_IMAGE_EDITOR_LABELS.add, overrides.add),
    types: pick(DEFAULT_IMAGE_EDITOR_LABELS.types, overrides.types),
  };
}

/** Fills `{name}` placeholders as plain text; unknown ones stay as written. */
export function fillLabel(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match
  );
}

/**
 * A plain-text summary of an edit for assistive tech, for example
 * "rotated 90°, cropped, 800 × 600 pixels, 2 adjustments, 1 annotations".
 * `output` is the size the edit renders at.
 */
export function describeEdit(
  edit: ImageEdit,
  output: SourceSize,
  labels: ImageEditorLabels
): string {
  const parts: string[] = [];
  if (edit.rotate !== 0) parts.push(fillLabel(labels.summaryRotate, { degrees: edit.rotate }));
  if (edit.flipX) parts.push(labels.summaryFlipX);
  if (edit.flipY) parts.push(labels.summaryFlipY);
  if (edit.crop) parts.push(labels.summaryCrop);
  const changedFilters = FILTER_NAMES.filter(
    (name) => edit.filters[name] !== FILTER_RANGES[name].neutral
  ).length;
  if (parts.length === 0 && changedFilters === 0 && edit.annotations.length === 0 && !edit.resize) {
    return labels.summaryNone;
  }
  parts.push(fillLabel(labels.summarySize, { width: output.width, height: output.height }));
  if (changedFilters > 0) parts.push(fillLabel(labels.summaryFilters, { count: changedFilters }));
  if (edit.annotations.length > 0) {
    parts.push(fillLabel(labels.summaryAnnotations, { count: edit.annotations.length }));
  }
  return parts.join(', ');
}
