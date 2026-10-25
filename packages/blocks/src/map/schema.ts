import {
  type BlockBase,
  type FieldIssue,
  fail,
  failMany,
  ok,
  type ParseResult,
  parseBlockBase,
  parseBlockId,
  parsePlainText,
} from '../core/schema/primitives.ts';
import { type BlockTone, isBlockTone } from '../core/schema/vocabulary.ts';

/**
 * Map block (T-blocks-map): points on an offline, fictional basemap. A map
 * block never loads tiles, geocodes or touches the network; coordinates are
 * plain numbers on a simulated map. Owned validator: strict keys, finite
 * numbers, unique ids, bounded sizes.
 */

/** Fictional basemaps that ship with `@texuli/data/geo`. */
export const MAP_BASEMAPS = ['port-meridian'] as const;
export type MapBasemapId = (typeof MAP_BASEMAPS)[number];

export const MAP_LIMITS = Object.freeze({
  points: 50,
  route: 20,
  label: 120,
  pointLabel: 80,
  description: 200,
  /** Web Mercator stops being finite at the poles. */
  maxLatitude: 85.06,
});

export type MapPoint = {
  id: string;
  label: string;
  lng: number;
  lat: number;
  description?: string;
  tone?: BlockTone;
};

export type MapBlock = BlockBase & {
  type: 'map';
  /** Accessible name of the map (required). */
  label: string;
  title?: string;
  basemap?: MapBasemapId;
  points: MapPoint[];
  /** Point ids joined by a route line, in order. */
  route?: string[];
};

const BLOCK_KEYS = new Set([
  'type',
  'id',
  'step',
  'reveal',
  'tone',
  'label',
  'title',
  'basemap',
  'points',
  'route',
]);
const POINT_KEYS = new Set(['id', 'label', 'lng', 'lat', 'description', 'tone']);

function plainRecord(
  value: unknown,
  path: (string | number)[],
  what: string
): ParseResult<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return fail(path, `Expected a ${what} object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return fail(path, `${what} must be plain JSON data`);
  }
  return ok(value as Record<string, unknown>);
}

function unknownKeys(
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: (string | number)[]
): FieldIssue[] {
  return Object.keys(record)
    .filter((key) => !allowed.has(key))
    .map((key) => ({ path: [...path, key], message: `Unknown field "${key}"` }));
}

function coordinate(value: unknown, path: (string | number)[], limit: number): ParseResult<number> {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return fail(path, 'Expected a finite number');
  if (value < -limit || value > limit) return fail(path, `Must be between -${limit} and ${limit}`);
  return ok(value);
}

function parsePoint(value: unknown, path: (string | number)[]): ParseResult<MapPoint> {
  const record = plainRecord(value, path, 'point');
  if (!record.success) return record;
  const point = record.data;
  const extra = unknownKeys(point, POINT_KEYS, path);
  if (extra.length > 0) return failMany(extra);

  if (point.id === undefined) return fail([...path, 'id'], 'point id is required');
  const id = parseBlockId(point.id, [...path, 'id']);
  if (!id.success) return id;
  const label = parsePlainText(point.label, [...path, 'label'], MAP_LIMITS.pointLabel);
  if (!label.success) return label;
  const lng = coordinate(point.lng, [...path, 'lng'], 180);
  if (!lng.success) return lng;
  const lat = coordinate(point.lat, [...path, 'lat'], MAP_LIMITS.maxLatitude);
  if (!lat.success) return lat;

  const parsed: MapPoint = {
    id: id.data as string,
    label: label.data,
    lng: lng.data,
    lat: lat.data,
  };
  if (point.description !== undefined) {
    const description = parsePlainText(
      point.description,
      [...path, 'description'],
      MAP_LIMITS.description
    );
    if (!description.success) return description;
    parsed.description = description.data;
  }
  if (point.tone !== undefined) {
    if (!isBlockTone(point.tone)) return fail([...path, 'tone'], 'Unknown tone');
    parsed.tone = point.tone;
  }
  return ok(parsed);
}

/** Validates untrusted data as a map block. */
export function parseMapBlock(
  value: unknown,
  path: (string | number)[] = []
): ParseResult<MapBlock> {
  const record = plainRecord(value, path, 'block');
  if (!record.success) return record;
  const block = record.data;
  if (block.type !== 'map') return fail([...path, 'type'], 'Expected a map block');
  const extra = unknownKeys(block, BLOCK_KEYS, path);
  if (extra.length > 0) return failMany(extra);
  const base = parseBlockBase(block, path);
  if (!base.success) return base;

  const label = parsePlainText(block.label, [...path, 'label'], MAP_LIMITS.label);
  if (!label.success) return label;
  const parsed: MapBlock = { ...base.data, type: 'map', label: label.data, points: [] };

  if (block.title !== undefined) {
    const title = parsePlainText(block.title, [...path, 'title'], MAP_LIMITS.label);
    if (!title.success) return title;
    parsed.title = title.data;
  }
  if (block.basemap !== undefined) {
    if (!(MAP_BASEMAPS as readonly unknown[]).includes(block.basemap)) {
      return fail([...path, 'basemap'], `basemap must be one of: ${MAP_BASEMAPS.join(', ')}`);
    }
    parsed.basemap = block.basemap as MapBasemapId;
  }

  if (!Array.isArray(block.points) || block.points.length === 0) {
    return fail([...path, 'points'], 'map needs at least one point');
  }
  if (block.points.length > MAP_LIMITS.points) {
    return fail([...path, 'points'], `map may contain at most ${MAP_LIMITS.points} points`);
  }
  const ids = new Set<string>();
  const issues: FieldIssue[] = [];
  block.points.forEach((raw, index) => {
    const point = parsePoint(raw, [...path, 'points', index]);
    if (!point.success) {
      issues.push(...point.issues);
      return;
    }
    if (ids.has(point.data.id)) {
      issues.push({
        path: [...path, 'points', index, 'id'],
        message: `Repeated point id "${point.data.id}"`,
      });
      return;
    }
    ids.add(point.data.id);
    parsed.points.push(point.data);
  });
  if (issues.length > 0) return failMany(issues);

  if (block.route !== undefined) {
    if (!Array.isArray(block.route) || block.route.length < 2) {
      return fail([...path, 'route'], 'route needs at least two point ids');
    }
    if (block.route.length > MAP_LIMITS.route) {
      return fail([...path, 'route'], `route may contain at most ${MAP_LIMITS.route} stops`);
    }
    const route: string[] = [];
    for (let index = 0; index < block.route.length; index += 1) {
      const stop = block.route[index];
      if (typeof stop !== 'string' || !ids.has(stop)) {
        return fail([...path, 'route', index], 'Name one of the point ids');
      }
      if (route[route.length - 1] === stop) {
        return fail([...path, 'route', index], 'A stop cannot repeat the previous one');
      }
      route.push(stop);
    }
    parsed.route = route;
  }
  return ok(parsed);
}

export function isMapBlock(value: unknown): value is MapBlock {
  return parseMapBlock(value).success;
}
