/** Every string the canvas view shows or announces. Pass translations to override. */
export interface CompositionCanvasLabels {
  /** Accessible name when no `label` prop is given. */
  canvas: string;
  /** How to drive the view from the keyboard. */
  keyboardHint: string;
  /** Accessible name of the group of view buttons. */
  controls: string;
  zoomIn: string;
  zoomOut: string;
  resetView: string;
  panLeft: string;
  panRight: string;
  panUp: string;
  panDown: string;
  /** Announced after the zoom changes, for example "Zoom 125%". */
  zoomStatus: (percent: number) => string;
  /** Heading of the list of text and image descriptions inside the canvas. */
  contents: string;
  /** Prefix for an image's alt text in that list. */
  image: string;
  /** Shown while the renderer loads. */
  loading: string;
  /** Shown instead of the canvas when the data is rejected. */
  invalid: string;
  /** Shown when the browser cannot draw a 2D canvas. */
  unsupported: string;
}

export const DEFAULT_COMPOSITION_CANVAS_LABELS: Readonly<CompositionCanvasLabels> = Object.freeze({
  canvas: 'Composition',
  keyboardHint:
    'Use the view buttons to zoom and pan. While one has focus, plus and minus zoom, arrow keys pan and 0 resets the view.',
  controls: 'View',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  resetView: 'Reset view',
  panLeft: 'Pan left',
  panRight: 'Pan right',
  panUp: 'Pan up',
  panDown: 'Pan down',
  zoomStatus: (percent: number) => `Zoom ${percent}%`,
  contents: 'Text and images in this composition',
  image: 'Image',
  loading: 'Loading composition…',
  invalid: 'This composition could not be shown because its data is not valid.',
  unsupported: 'This browser cannot draw the composition.',
});

/** Merges partial translations over the English defaults. */
export function resolveCompositionCanvasLabels(
  labels?: Partial<CompositionCanvasLabels>
): CompositionCanvasLabels {
  return { ...DEFAULT_COMPOSITION_CANVAS_LABELS, ...labels };
}
