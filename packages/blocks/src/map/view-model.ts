import {
  type Basemap,
  type BasemapPath,
  type Bbox,
  basemapPaths,
  fitBounds,
  type MapSize,
  type MapView,
  PORT_MERIDIAN,
  panBy,
  project,
  routeLength,
  zoomAround,
} from '@texuli/data/geo';
import type { BlockTone } from '../core/schema/vocabulary.ts';
import type { MapBasemapId, MapBlock, MapPoint } from './schema.ts';

/**
 * Pure geometry for the map block renderer, over the offline geo engine of
 * `@texuli/data/geo`. Only the Svelte view imports this module, so the
 * package root never pulls in the engine.
 */

export const MAP_BLOCK_SIZE: MapSize = Object.freeze({ width: 800, height: 450 });
/**
 * Drawing size for a measured canvas width: 1:1 pixels (so map text keeps
 * its size on a phone), 16:9 with a taller minimum on narrow screens. An
 * unmeasured canvas (server render, tests) uses `MAP_BLOCK_SIZE`.
 */
export function mapSizeFor(width: number): MapSize {
  if (!Number.isFinite(width) || width <= 0) return MAP_BLOCK_SIZE;
  const w = Math.round(Math.min(width, 2_000));
  return { width: w, height: Math.round(Math.max(240, (w * 9) / 16)) };
}

/** Screen pixels one arrow-key press pans. */
export const MAP_PAN_STEP = 64;

const BASEMAPS: Readonly<Record<MapBasemapId, Basemap>> = { 'port-meridian': PORT_MERIDIAN };

export function basemapFor(block: Pick<MapBlock, 'basemap'>): Basemap {
  return BASEMAPS[block.basemap ?? 'port-meridian'];
}

/**
 * The view that frames every point. A lone point (or a tight cluster) gets
 * at least a quarter of the basemap around it, so it is never zoomed to a dot.
 */
export function fitPoints(
  points: readonly MapPoint[],
  basemap: Basemap,
  size = MAP_BLOCK_SIZE
): MapView {
  let [minLng, minLat, maxLng, maxLat] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const point of points) {
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
  }
  if (!Number.isFinite(minLng)) return fitBounds(basemap.bbox, size, 24);
  const [bMinLng, bMinLat, bMaxLng, bMaxLat] = basemap.bbox;
  const minSpanLng = (bMaxLng - bMinLng) / 4;
  const minSpanLat = (bMaxLat - bMinLat) / 4;
  const padLng = Math.max((maxLng - minLng) * 0.15, (minSpanLng - (maxLng - minLng)) / 2, 0);
  const padLat = Math.max((maxLat - minLat) * 0.15, (minSpanLat - (maxLat - minLat)) / 2, 0);
  const box: Bbox = [minLng - padLng, minLat - padLat, maxLng + padLng, maxLat + padLat];
  return fitBounds(box, size, 32);
}

export interface PlacedPoint extends MapPoint {
  x: number;
  y: number;
  /** Inside the visible map (with a small margin for the marker). */
  visible: boolean;
}

export function placePoints(
  points: readonly MapPoint[],
  view: MapView,
  size = MAP_BLOCK_SIZE
): PlacedPoint[] {
  return points.map((point) => {
    const { x, y } = project(point, view, size);
    const visible = x >= -12 && x <= size.width + 12 && y >= -12 && y <= size.height + 12;
    return { ...point, x: round(x), y: round(y), visible };
  });
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Ordered stops of the route (ids already validated to exist). */
export function routeStops(block: Pick<MapBlock, 'points' | 'route'>): MapPoint[] {
  if (!block.route) return [];
  const byId = new Map(block.points.map((point) => [point.id, point]));
  return block.route
    .map((id) => byId.get(id))
    .filter((point): point is MapPoint => point !== undefined);
}

/** SVG path data for the route (numbers and M/L only), or `undefined`. */
export function routePath(
  stops: readonly MapPoint[],
  view: MapView,
  size = MAP_BLOCK_SIZE
): string | undefined {
  if (stops.length < 2) return undefined;
  return stops
    .map((stop, index) => {
      const { x, y } = project(stop, view, size);
      return `${index === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`;
    })
    .join(' ');
}

/** Route length in meters along the stops (great-circle legs). */
export function routeMeters(stops: readonly MapPoint[]): number {
  return stops.length < 2 ? 0 : routeLength(stops);
}

export function basemapFeatures(
  basemap: Basemap,
  view: MapView,
  size = MAP_BLOCK_SIZE
): BasemapPath[] {
  return basemapPaths(basemap, view, size);
}

/** Approximate width of one marker-label character, in px (13px semibold). */
const LABEL_CHAR = 7.5;

/** A marker label sits at the inline end of its dot, or flips when it would overflow. */
export function markerLabelFlips(
  point: Pick<PlacedPoint, 'x' | 'label'>,
  size = MAP_BLOCK_SIZE
): boolean {
  return point.x + 16 + point.label.length * LABEL_CHAR > size.width;
}

/**
 * Basemap features whose labels stay clear of the marker labels: a feature
 * label inside a marker label's box (on whichever side the label sits) is
 * dropped, so place names never print over each other.
 */
export function clearFeatureLabels(
  features: readonly BasemapPath[],
  markers: readonly Pick<PlacedPoint, 'x' | 'y' | 'visible' | 'label'>[],
  size = MAP_BLOCK_SIZE
): BasemapPath[] {
  const boxes = markers
    .filter((marker) => marker.visible)
    .map((marker) => {
      const width = 16 + marker.label.length * LABEL_CHAR;
      const flips = markerLabelFlips(marker, size);
      return {
        left: flips ? marker.x - width : marker.x - 16,
        right: flips ? marker.x + 16 : marker.x + width,
        top: marker.y - 16,
        bottom: marker.y + 16,
      };
    });
  return features.map((feature) => {
    const label = feature.label;
    if (!label) return feature;
    const hit = boxes.some(
      (box) =>
        label.x >= box.left && label.x <= box.right && label.y >= box.top && label.y <= box.bottom
    );
    if (!hit) return feature;
    const { label: _dropped, ...rest } = feature;
    return rest;
  });
}

export type MapKeyAction =
  | 'pan-up'
  | 'pan-down'
  | 'pan-left'
  | 'pan-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'reset';

/**
 * Keyboard map: arrows pan (geography, so not mirrored in RTL), `+`/`=` and
 * `-` zoom, `0` and Home reset.
 */
export function mapKeyAction(key: string): MapKeyAction | undefined {
  switch (key) {
    case 'ArrowUp':
      return 'pan-up';
    case 'ArrowDown':
      return 'pan-down';
    case 'ArrowLeft':
      return 'pan-left';
    case 'ArrowRight':
      return 'pan-right';
    case '+':
    case '=':
      return 'zoom-in';
    case '-':
    case '_':
      return 'zoom-out';
    case '0':
    case 'Home':
      return 'reset';
    default:
      return undefined;
  }
}

/** Applies a keyboard or button action to a view. */
export function applyMapAction(
  view: MapView,
  action: MapKeyAction,
  home: MapView,
  size = MAP_BLOCK_SIZE
): MapView {
  switch (action) {
    case 'pan-up':
      return panBy(view, 0, MAP_PAN_STEP, size);
    case 'pan-down':
      return panBy(view, 0, -MAP_PAN_STEP, size);
    case 'pan-left':
      return panBy(view, MAP_PAN_STEP, 0, size);
    case 'pan-right':
      return panBy(view, -MAP_PAN_STEP, 0, size);
    case 'zoom-in':
      return zoomAround(view, 1, size);
    case 'zoom-out':
      return zoomAround(view, -1, size);
    default:
      return home;
  }
}

/** Marker class per tone; untoned points use the brand emphasis. */
export function toneClass(tone: BlockTone | undefined): string {
  return `tone-${tone ?? 'accent'}`;
}
