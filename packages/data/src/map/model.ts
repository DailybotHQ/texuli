import type { Basemap, BasemapPath } from '../engines/map/basemap.ts';
import { basemapPaths } from '../engines/map/basemap.ts';
import { cluster, type MapPoint } from '../engines/map/cluster.ts';
import type { Geofence } from '../engines/map/fence.ts';
import {
  fitBounds,
  type LngLat,
  type MapSize,
  type MapView,
  panBy,
  pointAlong,
  project,
  routeLength,
  zoomAround,
} from '../engines/map/geo.ts';

/**
 * Strong semantic tones for markers, routes and fences.
 * Prefer these over soft/accent surfaces so non-text contrast stays ≥ 3:1.
 * `default` and `accent` remain accepted aliases of `primary` for hosts mid-migration.
 */
export type MapTone = 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'neutral';
/** Marker silhouette; never color alone. */
export type MarkerShape = 'circle' | 'square' | 'diamond' | 'pin';

export interface MapMarker extends MapPoint {
  label: string;
  detail?: string;
  tone?: MapTone | 'default' | 'accent';
  shape?: MarkerShape;
  /** One or two characters drawn on the marker ("D", "!"). */
  glyph?: string;
}

/** A route through stops; `progress` (0–1) splits travelled vs remaining. */
export interface MapRoute {
  id: string;
  label: string;
  stops: readonly LngLat[];
  progress?: number;
  tone?: MapTone | 'default' | 'accent';
}

/** Fence drawn on the map (engine geofence + optional tone / list label). */
export type MapFence = Geofence & {
  tone?: MapTone | 'default' | 'accent';
  label?: string;
};

export interface PositionedMarker extends MapMarker {
  x: number;
  y: number;
}

export interface PositionedCluster {
  id: string;
  x: number;
  y: number;
  count: number;
  center: LngLat;
  bbox: readonly [number, number, number, number];
}

export const MAP_SIZE: MapSize = { width: 800, height: 480 };

/** Normalize host tone aliases to a strong role. */
export function resolveMapTone(tone: MapMarker['tone'] | undefined): MapTone {
  if (tone === 'info' || tone === 'success' || tone === 'warning' || tone === 'danger') return tone;
  if (tone === 'neutral') return 'neutral';
  // default, accent, primary, undefined → primary (strong fill, not soft accent surface)
  return 'primary';
}

export function initialMapView(basemap: Basemap, size = MAP_SIZE): MapView {
  return fitBounds(basemap.bbox, size, 28);
}

export function mapFeatures(basemap: Basemap, view: MapView, size = MAP_SIZE): BasemapPath[] {
  return basemapPaths(basemap, view, size);
}

export function positionMarkers(
  markers: readonly MapMarker[],
  view: MapView,
  size = MAP_SIZE,
  cellPx = 72
): { markers: PositionedMarker[]; clusters: PositionedCluster[] } {
  const points: PositionedMarker[] = [];
  const clusters: PositionedCluster[] = [];
  for (const item of cluster(markers, view.zoom, cellPx)) {
    if (item.kind === 'point') {
      const { x, y } = project(item.point, view, size);
      if (x >= -24 && x <= size.width + 24 && y >= -24 && y <= size.height + 24) {
        points.push({ ...item.point, x, y });
      }
    } else {
      const { x, y } = project(item.center, view, size);
      if (x >= -32 && x <= size.width + 32 && y >= -32 && y <= size.height + 32) {
        clusters.push({
          id: item.id,
          x,
          y,
          count: item.count,
          center: item.center,
          bbox: item.bbox,
        });
      }
    }
  }
  return { markers: points, clusters };
}

export function panMap(view: MapView, dx: number, dy: number, size = MAP_SIZE): MapView {
  return panBy(view, dx, dy, size);
}

export function zoomMap(
  view: MapView,
  delta: number,
  anchor?: { x: number; y: number },
  size = MAP_SIZE
): MapView {
  return zoomAround(view, delta, size, anchor);
}

export function centerOn(point: LngLat, zoom: number): MapView {
  return { center: point, zoom };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** SVG path through lng/lat points (M/L/Z only). */
export function linePath(
  points: readonly LngLat[],
  view: MapView,
  size: MapSize,
  close = false
): string {
  const parts = points.map((p, i) => {
    const { x, y } = project(p, view, size);
    return `${i === 0 ? 'M' : 'L'}${r1(x)} ${r1(y)}`;
  });
  return parts.length > 0 ? `${parts.join('')}${close ? 'Z' : ''}` : '';
}

/** Travelled segment and tip for a route `progress` in [0, 1]. */
export function routeProgress(route: MapRoute): { travelled: LngLat[]; at: LngLat | null } {
  if (route.stops.length === 0) return { travelled: [], at: null };
  const progress = Math.min(1, Math.max(0, route.progress ?? 0));
  const target = routeLength(route.stops) * progress;
  const at = pointAlong([...route.stops], target);
  const travelled: LngLat[] = [route.stops[0] as LngLat];
  let walked = 0;
  for (let i = 1; i < route.stops.length; i++) {
    walked += routeLength([route.stops[i - 1] as LngLat, route.stops[i] as LngLat]);
    if (walked > target) break;
    travelled.push(route.stops[i] as LngLat);
  }
  travelled.push(at);
  return { travelled, at };
}

/** Screen radius of a circle fence (meters → px at its latitude). */
export function circleRadiusPx(
  fence: Extract<Geofence, { shape: 'circle' }>,
  view: MapView
): number {
  const metersPerPx =
    (Math.cos((fence.center[1] * Math.PI) / 180) * 2 * Math.PI * 6_371_008.8) /
    (256 * 2 ** view.zoom);
  return fence.radiusMeters / metersPerPx;
}

export type { Geofence, LngLat, MapSize, MapView };
