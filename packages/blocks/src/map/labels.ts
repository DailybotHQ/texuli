/**
 * Every string the map block renders that does not come from the block.
 * Hosts pass translations; English is the default. `{count}`, `{distance}`
 * and `{label}` are replaced at render time.
 */
export interface MapBlockLabels {
  invalid: string;
  /** `aria-roledescription` of the interactive map surface. */
  roleDescription: string;
  zoomIn: string;
  zoomOut: string;
  reset: string;
  controls: string;
  /** Visible hint under the map. */
  keyboardHint: string;
  places: string;
  route: string;
  /** Route summary, e.g. "4 stops · 3.2 km". */
  routeSummary: string;
  selected: string;
  offMap: string;
}

export type MapBlockLabelOverrides = Partial<MapBlockLabels>;

export const DEFAULT_MAP_BLOCK_LABELS: Readonly<MapBlockLabels> = Object.freeze({
  invalid: 'This block could not be shown.',
  roleDescription: 'map',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  reset: 'Reset view',
  controls: 'Map controls',
  keyboardHint: 'Focus the map, then use the arrow keys to pan and + or − to zoom.',
  places: 'Places',
  route: 'Route',
  routeSummary: '{count} stops · {distance}',
  selected: 'Selected: {label}',
  offMap: 'outside the current view',
});

export function resolveMapBlockLabels(overrides: MapBlockLabelOverrides = {}): MapBlockLabels {
  return { ...DEFAULT_MAP_BLOCK_LABELS, ...overrides };
}

/** Replaces `{name}` placeholders; unknown names stay as written. */
export function formatMapLabel(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match
  );
}
