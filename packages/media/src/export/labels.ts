/** Every string the export control shows or announces. Pass translations to override. */
export interface CompositionExportLabels {
  /** Accessible name of the group of export buttons. */
  group: string;
  png: string;
  svg: string;
  webm: string;
  cancel: string;
  /** Shown and announced while an export runs (`format` is PNG, SVG or WebM). */
  working: (format: string) => string;
  /** Recording progress, for example "Recording WebM: 40%". */
  recording: (percent: number) => string;
  /** Announced when the file is saved. */
  done: (filename: string) => string;
  /** Added when some images were left out (refused by the URL policy or failed to load). */
  skippedImages: (count: number) => string;
  invalid: string;
  tainted: string;
  unsupported: string;
  /** Why WebM is unavailable in this browser. */
  webmUnsupported: string;
  aborted: string;
  failed: string;
}

export const DEFAULT_COMPOSITION_EXPORT_LABELS: Readonly<CompositionExportLabels> = Object.freeze({
  group: 'Export',
  png: 'Export PNG',
  svg: 'Export SVG',
  webm: 'Export WebM',
  cancel: 'Cancel recording',
  working: (format: string) => `Exporting ${format}…`,
  recording: (percent: number) => `Recording WebM: ${percent}%`,
  done: (filename: string) => `Saved ${filename}.`,
  skippedImages: (count: number) =>
    count === 1 ? '1 image was left out.' : `${count} images were left out.`,
  invalid: 'This composition could not be exported because its data is not valid.',
  tainted: 'An image does not allow export from this page, so the file could not be made.',
  unsupported: 'This browser cannot make this file.',
  webmUnsupported: 'This browser cannot record WebM video.',
  aborted: 'Recording canceled.',
  failed: 'The export failed. Try again.',
});

/** Merges overrides over the English defaults; values of the wrong type are ignored. */
export function resolveCompositionExportLabels(
  overrides: Partial<CompositionExportLabels> = {}
): CompositionExportLabels {
  const labels = { ...DEFAULT_COMPOSITION_EXPORT_LABELS } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    if (key in labels && typeof value === typeof labels[key]) labels[key] = value;
  }
  return labels as unknown as CompositionExportLabels;
}
