import { sequentialColor } from '../colors/index.ts';
import { extent } from '../math/scales/extent.ts';
/**
 * Bundled schematic tile shapes. They are intentionally not geographic borders
 * or a claim of exact geography; they make map charts useful offline without
 * shipping a third-party map database.
 */
export interface GeoTile {
  id: string;
  label: string;
  abbr: string;
  col: number;
  row: number;
}

export interface GeoCell extends GeoTile {
  x: number;
  y: number;
  size: number;
}

export interface GeoPointDatum {
  id: string;
  label: string;
  regionId: string;
  value: number | null;
  /** Normalized offset within the region tile, clamped to -0.4..0.4. */
  offset?: { x: number; y: number };
}

export interface GeoTableLabels {
  table: string;
  region: string;
  point: string;
  location: string;
  value: string;
  noData: string;
  low: string;
  high: string;
}

export const GEO_TABLE_LABELS: GeoTableLabels = {
  table: 'View data table',
  region: 'Region',
  point: 'Point',
  location: 'Location',
  value: 'Value',
  noData: 'No data',
  low: 'Lower values',
  high: 'Higher values',
};

export const REGION_TILES: readonly GeoTile[] = [
  { id: 'north-ridge', label: 'North Ridge', abbr: 'NR', col: 1, row: 0 },
  { id: 'pine-hollow', label: 'Pine Hollow', abbr: 'PH', col: 2, row: 0 },
  { id: 'west-shore', label: 'West Shore', abbr: 'WS', col: 0, row: 1 },
  { id: 'old-town', label: 'Old Town', abbr: 'OT', col: 1, row: 1 },
  { id: 'harbor-point', label: 'Harbor Point', abbr: 'HP', col: 2, row: 1 },
  { id: 'east-quay', label: 'East Quay', abbr: 'EQ', col: 3, row: 1 },
  { id: 'mill-district', label: 'Mill District', abbr: 'MD', col: 0, row: 2 },
  { id: 'lantern-row', label: 'Lantern Row', abbr: 'LR', col: 1, row: 2 },
  { id: 'coral-flats', label: 'Coral Flats', abbr: 'CF', col: 2, row: 2 },
  { id: 'south-bend', label: 'South Bend', abbr: 'SB', col: 1, row: 3 },
  { id: 'tidewater', label: 'Tidewater', abbr: 'TW', col: 2, row: 3 },
];

export const WORLD_TILES: readonly GeoTile[] = [
  { id: 'north-america', label: 'North America', abbr: 'NAM', col: 0, row: 0 },
  { id: 'northern-europe', label: 'Northern Europe', abbr: 'NEU', col: 2, row: 0 },
  { id: 'eastern-europe', label: 'Eastern Europe', abbr: 'EEU', col: 3, row: 0 },
  { id: 'central-asia', label: 'Central Asia', abbr: 'CAS', col: 4, row: 0 },
  { id: 'east-asia', label: 'East Asia', abbr: 'EAS', col: 5, row: 0 },
  { id: 'central-america', label: 'Central America & Caribbean', abbr: 'CAM', col: 0, row: 1 },
  { id: 'western-europe', label: 'Western Europe', abbr: 'WEU', col: 2, row: 1 },
  { id: 'southern-europe', label: 'Southern Europe', abbr: 'SEU', col: 3, row: 1 },
  { id: 'middle-east', label: 'Middle East', abbr: 'MEA', col: 4, row: 1 },
  { id: 'south-asia', label: 'South Asia', abbr: 'SAS', col: 5, row: 1 },
  { id: 'south-america', label: 'South America', abbr: 'SAM', col: 1, row: 2 },
  { id: 'north-africa', label: 'North Africa', abbr: 'NAF', col: 3, row: 2 },
  { id: 'southeast-asia', label: 'Southeast Asia', abbr: 'SEA', col: 5, row: 2 },
  { id: 'sub-saharan-africa', label: 'Sub-Saharan Africa', abbr: 'SSA', col: 3, row: 3 },
  { id: 'oceania', label: 'Oceania', abbr: 'OCE', col: 6, row: 3 },
];

export function geoCells(
  shape: readonly GeoTile[],
  width: number,
  height: number,
  gap = 4
): GeoCell[] {
  if (!shape.length) return [];
  const safeWidth = Number.isFinite(width) ? Math.max(1, width) : 1;
  const safeHeight = Number.isFinite(height) ? Math.max(1, height) : 1;
  const columns = Math.max(1, ...shape.map((tile) => Math.max(0, Math.trunc(tile.col)) + 1));
  const rows = Math.max(1, ...shape.map((tile) => Math.max(0, Math.trunc(tile.row)) + 1));
  const safeGap = Number.isFinite(gap) ? Math.max(0, gap) : 0;
  const size = Math.max(
    1,
    Math.min(
      (safeWidth - safeGap * (columns - 1)) / columns,
      (safeHeight - safeGap * (rows - 1)) / rows
    )
  );
  const left = (safeWidth - (columns * size + (columns - 1) * safeGap)) / 2;
  const top = (safeHeight - (rows * size + (rows - 1) * safeGap)) / 2;
  return [...shape]
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((tile) => ({
      ...tile,
      x: left + Math.max(0, tile.col) * (size + safeGap),
      y: top + Math.max(0, tile.row) * (size + safeGap),
      size,
    }));
}

export function geoValue(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function geoColorIndex(
  value: number | null,
  values: readonly (number | null)[]
): number | null {
  if (value === null) return null;
  const finite = values.filter((candidate): candidate is number => candidate !== null);
  if (!finite.length) return null;
  const [min, max] = extent(finite) ?? [0, 0];
  if (max === min) return 4;
  // Halved terms keep the ratio finite when max - min would overflow.
  const t = (value / 2 - min / 2) / (max / 2 - min / 2);
  return Number.isFinite(t) ? Math.min(8, Math.max(0, Math.floor(t * 9))) : null;
}

export function geoColor(index: number): string {
  const slot = Number.isFinite(index) ? Math.min(8, Math.max(0, Math.trunc(index))) : 0;
  return sequentialColor(slot / 8);
}

export function clampGeoOffset(value: number | undefined): number {
  return Number.isFinite(value) ? Math.min(0.4, Math.max(-0.4, value as number)) : 0;
}

export function formatGeoValue(value: number | null): string {
  return value === null
    ? GEO_TABLE_LABELS.noData
    : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}
