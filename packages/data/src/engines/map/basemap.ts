import {
  boundedNumber,
  boundedString,
  createSchema,
  enumValue,
  recordOf,
  strictKeys,
  ValidationError,
} from '../validation.ts';
import { type Bbox, type MapSize, type MapView, project, viewBounds } from './geo.ts';

/**
 * A basemap is plain data: features with flat `[lng, lat, lng, lat, …]`
 * coordinate arrays. Prototypes can pass their own (validated here) for other
 * fictional places. Rendering produces SVG path `d` strings built only from
 * numbers, so a basemap from data can never inject markup.
 */

export const BASEMAP_KINDS = ['land', 'water', 'park', 'district', 'road', 'rail'] as const;
export type BasemapKind = (typeof BASEMAP_KINDS)[number];

export interface BasemapFeature {
  id: string;
  kind: BasemapKind;
  name?: string;
  /** Where to place the name, as `[lng, lat]` (polygons default to their first vertex). */
  label?: [number, number];
  geometry: 'polygon' | 'line';
  coords: number[];
}

function parseBasemapFeature(input: unknown): BasemapFeature {
  const value = recordOf(input, 'basemap feature');
  strictKeys(value, ['id', 'kind', 'name', 'label', 'geometry', 'coords'], 'basemap feature');
  const geometry = enumValue(value.geometry, ['polygon', 'line'], 'geometry');
  const minPairs = geometry === 'polygon' ? 3 : 2;
  if (
    !Array.isArray(value.coords) ||
    value.coords.length < minPairs * 2 ||
    value.coords.length > 20_000 ||
    value.coords.length % 2 !== 0
  ) {
    throw new ValidationError('coordinates must contain complete longitude/latitude pairs');
  }
  const coords = value.coords.map((coordinate, index) => {
    const number = boundedNumber(
      coordinate,
      `coordinate ${index}`,
      index % 2 === 0 ? -180 : -85.06,
      index % 2 === 0 ? 180 : 85.06
    );
    return number;
  });
  const feature: BasemapFeature = {
    id: boundedString(value.id, 'feature id', 1, 64),
    kind: enumValue(value.kind, BASEMAP_KINDS, 'kind'),
    geometry,
    coords,
  };
  if (value.name !== undefined) feature.name = boundedString(value.name, 'feature name', 1, 80);
  if (value.label !== undefined) {
    if (!Array.isArray(value.label) || value.label.length !== 2)
      throw new ValidationError('label must be a coordinate pair');
    feature.label = [
      boundedNumber(value.label[0], 'label longitude', -180, 180),
      boundedNumber(value.label[1], 'label latitude', -85.06, 85.06),
    ];
  }
  return feature;
}

export const BasemapFeatureSchema = createSchema<BasemapFeature>(parseBasemapFeature);

export interface Basemap {
  id: string;
  name: string;
  /** `[minLng, minLat, maxLng, maxLat]`: what "fit the map" shows. */
  bbox: [number, number, number, number];
  /** Always shown on the map; say that the place is fictional. */
  attribution: string;
  features: BasemapFeature[];
}

export const BasemapSchema = createSchema<Basemap>((input) => {
  const value = recordOf(input, 'basemap');
  strictKeys(value, ['id', 'name', 'bbox', 'attribution', 'features'], 'basemap');
  if (!Array.isArray(value.bbox) || value.bbox.length !== 4)
    throw new ValidationError('bbox must contain four numbers');
  if (!Array.isArray(value.features) || value.features.length > 2000)
    throw new ValidationError('features must be an array of at most 2,000 items');
  return {
    id: boundedString(value.id, 'id', 1, 64),
    name: boundedString(value.name, 'name', 1, 80),
    bbox: value.bbox.map((coordinate, index) =>
      boundedNumber(
        coordinate,
        `bbox coordinate ${index}`,
        index % 2 === 0 ? -180 : -85.06,
        index % 2 === 0 ? 180 : 85.06
      )
    ) as [number, number, number, number],
    attribution: boundedString(value.attribution, 'attribution', 1, 120),
    features: value.features.map(parseBasemapFeature),
  };
});

export interface BasemapPath {
  id: string;
  kind: BasemapKind;
  name?: string;
  closed: boolean;
  /** SVG path data in screen px (numbers and M/L/Z only). */
  d: string;
  label?: { x: number; y: number; text: string };
}

function featureBox(values: readonly number[]): Bbox {
  let minLng = Number.POSITIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < values.length; i += 2) {
    minLng = Math.min(minLng, values[i] as number);
    maxLng = Math.max(maxLng, values[i] as number);
    minLat = Math.min(minLat, values[i + 1] as number);
    maxLat = Math.max(maxLat, values[i + 1] as number);
  }
  return [minLng, minLat, maxLng, maxLat];
}

function overlaps(a: Bbox, b: Bbox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Screen paths for the features that overlap the view, in basemap order
 * (land first, roads last, as authored). Labels are placed at `label` or the
 * first vertex.
 */
export function basemapPaths(basemap: Basemap, view: MapView, size: MapSize): BasemapPath[] {
  const visible = viewBounds(view, size);
  const paths: BasemapPath[] = [];
  for (const feature of basemap.features) {
    if (!overlaps(featureBox(feature.coords), visible)) continue;
    const parts: string[] = [];
    for (let i = 0; i < feature.coords.length; i += 2) {
      const p = project(
        { lng: feature.coords[i] as number, lat: feature.coords[i + 1] as number },
        view,
        size
      );
      parts.push(`${i === 0 ? 'M' : 'L'}${round(p.x)} ${round(p.y)}`);
    }
    const closed = feature.geometry === 'polygon';
    const path: BasemapPath = {
      id: feature.id,
      kind: feature.kind,
      closed,
      d: parts.join('') + (closed ? 'Z' : ''),
    };
    if (feature.name) {
      path.name = feature.name;
      const [lng, lat] = feature.label ?? [
        feature.coords[0] as number,
        feature.coords[1] as number,
      ];
      const at = project({ lng, lat }, view, size);
      path.label = { x: round(at.x), y: round(at.y), text: feature.name };
    }
    paths.push(path);
  }
  return paths;
}
