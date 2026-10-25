import type { Composition, CompositionLayer } from '../composition-model/types.ts';
import type { CompositionLayerV2, CompositionV2, GroupLayer, LayerTiming } from './types.ts';

/** A leaf's effective time window after every enclosing group's window. */
export interface LayerWindow {
  layerId: string;
  startMs: number;
  endMs: number;
}

/** Animated values for a group at one instant (see `sampleCompositionV2`). */
export interface GroupState {
  opacity?: number;
  offsetX?: number;
  offsetY?: number;
}

const FRAME_BOUND = 32_768;
const clampCoordinate = (value: number) => Math.min(Math.max(value, -FRAME_BOUND), FRAME_BOUND);

function durationOf(composition: CompositionV2): number {
  return composition.durationMs ?? 0;
}

/**
 * Whether a window covers `timeMs`. Windows are half-open, except that a
 * window reaching the end of the composition includes the final instant, so
 * the last frame shows what was on screen just before it.
 */
function covers(start: number, end: number, timeMs: number, durationMs: number): boolean {
  return timeMs >= start && (timeMs < end || (end === durationMs && timeMs === durationMs));
}

function narrow(timing: LayerTiming | undefined, start: number, end: number): [number, number] {
  if (!timing) return [start, end];
  return [Math.max(start, timing.startMs), Math.min(end, timing.endMs ?? end)];
}

/** Every leaf's effective window, in paint order. Static compositions report `[0, 0]`. */
export function resolveLayerWindows(composition: CompositionV2): LayerWindow[] {
  const durationMs = durationOf(composition);
  const out: LayerWindow[] = [];
  const walk = (layers: readonly CompositionLayerV2[], start: number, end: number) => {
    for (const layer of layers) {
      const [s, e] = narrow(layer.timing, start, end);
      if (layer.type === 'group') walk(layer.children, s, e);
      else out.push({ layerId: layer.id, startMs: s, endMs: e });
    }
  };
  walk(composition.layers, 0, durationMs);
  return out;
}

function leafWithout(
  layer: CompositionLayerV2 & { type: CompositionLayer['type'] }
): CompositionLayer {
  const { timing: _timing, ...rest } = layer as CompositionLayer & { timing?: LayerTiming };
  return rest as CompositionLayer;
}

/**
 * The flat v1 scene on screen at `timeMs` (clamped to the composition): layers
 * outside their window, or inside an inactive group, are left out; group
 * offsets move their leaves' frames and group opacity multiplies into theirs.
 * A leaf whose mask layer is off screen is hidden, unless the mask is inverted,
 * in which case it shows unmasked. The result is a valid v1 composition that
 * every v1 renderer and exporter accepts. `groups` overrides group values
 * (used for animation).
 */
export function resolveCompositionAt(
  composition: CompositionV2,
  timeMs: number,
  groups: ReadonlyMap<string, GroupState> = new Map()
): Composition {
  const durationMs = durationOf(composition);
  const time = Math.min(Math.max(Number.isFinite(timeMs) ? timeMs : 0, 0), durationMs);
  const leaves: CompositionLayer[] = [];

  const walk = (
    layers: readonly CompositionLayerV2[],
    start: number,
    end: number,
    dx: number,
    dy: number,
    alpha: number
  ) => {
    for (const layer of layers) {
      const [s, e] = narrow(layer.timing, start, end);
      if (durationMs > 0 && !covers(s, e, time, durationMs)) continue;
      if (layer.type === 'group') {
        const state = groups.get(layer.id);
        const group: GroupLayer = layer;
        walk(
          group.children,
          s,
          e,
          dx + (state?.offsetX ?? group.offset?.x ?? 0),
          dy + (state?.offsetY ?? group.offset?.y ?? 0),
          alpha * (state?.opacity ?? group.opacity ?? 1)
        );
        continue;
      }
      const leaf = leafWithout(layer);
      const opacity = (leaf.opacity ?? 1) * alpha;
      leaves.push({
        ...leaf,
        // Nested offsets can sum past the v1 frame bounds; such a layer is far
        // off canvas, so clamping keeps the snapshot valid without changing it.
        frame: {
          ...leaf.frame,
          x: clampCoordinate(leaf.frame.x + dx),
          y: clampCoordinate(leaf.frame.y + dy),
        },
        ...(leaf.opacity !== undefined || alpha !== 1 ? { opacity } : {}),
      });
    }
  };
  walk(composition.layers, 0, durationMs, 0, 0, 1);

  // Hiding a mask layer can hide the layers it masks, which may mask others:
  // repeat until no layer changes (mask graphs are acyclic, so this ends).
  let layers = leaves;
  for (;;) {
    const visible = new Set(layers.map((layer) => layer.id));
    const next = layers.flatMap((layer): CompositionLayer[] => {
      if (!layer.mask || visible.has(layer.mask.layerId)) return [layer];
      if (!layer.mask.invert) return [];
      const { mask: _mask, ...unmasked } = layer;
      return [unmasked as CompositionLayer];
    });
    const changed =
      next.length !== layers.length || next.some((layer, index) => layer !== layers[index]);
    layers = next;
    if (!changed) break;
  }

  return {
    version: 1,
    width: composition.width,
    height: composition.height,
    ...(composition.durationMs === undefined ? {} : { durationMs: composition.durationMs }),
    layers,
  };
}

/**
 * Every leaf of a v2 composition as one static v1 composition, in paint order,
 * ignoring groups and timing: what an exporter preloads (image sources) and
 * reports (provenance) for the whole timeline.
 */
export function compositionLeaves(composition: CompositionV2): Composition {
  const leaves: CompositionLayer[] = [];
  const walk = (layers: readonly CompositionLayerV2[]) => {
    for (const layer of layers) {
      if (layer.type === 'group') walk(layer.children);
      else leaves.push(leafWithout(layer));
    }
  };
  walk(composition.layers);
  return {
    version: 1,
    width: composition.width,
    height: composition.height,
    ...(composition.durationMs === undefined ? {} : { durationMs: composition.durationMs }),
    layers: leaves,
  };
}
