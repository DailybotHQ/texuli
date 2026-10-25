import type { CompositionAnimation, EasingName, LayerKeyframe } from '../animation/types.ts';
import type { CompositionIssue } from '../composition-model/types.ts';
import { validateAnimationV2 } from '../composition-v2/animation.ts';
import type { CompositionLayerV2, CompositionV2, LayerTiming } from '../composition-v2/types.ts';

/** What the timeline edits: a v2 composition (layer windows) and its animation (keyframes). */
export interface TimelineDocument {
  composition: CompositionV2;
  animation: CompositionAnimation;
}

/** Keyframe values a timeline action may set (everything but `timeMs` and `easing`). */
export type KeyframeValues = Omit<LayerKeyframe, 'timeMs' | 'easing'>;

export type TimelineAction =
  | { type: 'set-window'; layerId: string; startMs: number; endMs?: number }
  | { type: 'clear-window'; layerId: string }
  | { type: 'add-keyframe'; layerId: string; timeMs: number; values?: KeyframeValues }
  | { type: 'move-keyframe'; layerId: string; index: number; timeMs: number }
  | { type: 'update-keyframe'; layerId: string; index: number; values: KeyframeValues }
  | { type: 'set-easing'; layerId: string; index: number; easing: EasingName }
  | { type: 'remove-keyframe'; layerId: string; index: number };

export type TimelineEditResult =
  | { ok: true; document: TimelineDocument }
  | { ok: false; errors: readonly CompositionIssue[] };

/** One row of the timeline, in paint order. */
export interface TimelineRow {
  layerId: string;
  kind: 'group' | 'shape' | 'text' | 'image';
  /** Nesting level: 0 for top-level layers. */
  depth: number;
  /** A short label: the text of a text layer, the alt of an image, else the id. */
  label: string;
  /** The layer's own window (its `timing`), or the whole timeline. */
  window: { startMs: number; endMs: number; own: boolean };
  /** The effective window after enclosing groups. */
  effective: { startMs: number; endMs: number };
  /** Keyframe times of the layer's track, in order. */
  keyframes: readonly number[];
}

export const TIMELINE_LIMITS = Object.freeze({
  maxHistory: 100,
  /** Shortest window a layer may keep, in milliseconds. */
  minWindowMs: 1,
});

const fail = (path: string, message: string, code: CompositionIssue['code'] = 'invalid-value') =>
  ({ ok: false, errors: [{ path, code, message }] }) as const;

const LABEL_LENGTH = 40;

function label(layer: CompositionLayerV2): string {
  const raw =
    layer.type === 'text' ? layer.text : layer.type === 'image' && layer.alt ? layer.alt : layer.id;
  const line = raw.replace(/\s+/g, ' ').trim() || layer.id;
  return line.length > LABEL_LENGTH ? `${line.slice(0, LABEL_LENGTH - 1)}…` : line;
}

/** The rows a timeline shows, with every layer's own and effective window and keyframes. */
export function timelineRows(document: TimelineDocument): TimelineRow[] {
  const durationMs = timelineDuration(document);
  const tracks = new Map(document.animation.tracks.map((track) => [track.layerId, track]));
  const rows: TimelineRow[] = [];
  const walk = (
    layers: readonly CompositionLayerV2[],
    depth: number,
    start: number,
    end: number
  ) => {
    for (const layer of layers) {
      const own = layer.timing !== undefined;
      const startMs = layer.timing?.startMs ?? 0;
      const endMs = layer.timing?.endMs ?? durationMs;
      const effective = { startMs: Math.max(start, startMs), endMs: Math.min(end, endMs) };
      rows.push({
        layerId: layer.id,
        kind: layer.type,
        depth,
        label: label(layer),
        window: { startMs, endMs, own },
        effective,
        keyframes: tracks.get(layer.id)?.keyframes.map((keyframe) => keyframe.timeMs) ?? [],
      });
      if (layer.type === 'group')
        walk(layer.children, depth + 1, effective.startMs, effective.endMs);
    }
  };
  walk(document.composition.layers, 0, 0, durationMs);
  return rows;
}

/**
 * The timeline's length: the animation's duration (the clock every sample
 * reads), never shorter than the composition's.
 */
export function timelineDuration(document: TimelineDocument): number {
  return Math.max(document.animation.durationMs, document.composition.durationMs ?? 0);
}

/** Round a time to the nearest `stepMs` within `[0, durationMs]`. */
export function snapTime(timeMs: number, stepMs: number, durationMs: number): number {
  const time = Number.isFinite(timeMs) ? timeMs : 0;
  const step = Number.isFinite(stepMs) && stepMs >= 1 ? Math.round(stepMs) : 1;
  return Math.min(Math.max(Math.round(time / step) * step, 0), durationMs);
}

function wholeMs(value: number, path: string, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max
    ? undefined
    : fail(path, `Expected a whole number of milliseconds from ${min} to ${max}.`);
}

function mapLayers(
  layers: readonly CompositionLayerV2[],
  id: string,
  update: (layer: CompositionLayerV2) => CompositionLayerV2
): { layers: CompositionLayerV2[]; found: boolean } {
  let found = false;
  const next = layers.map((layer) => {
    if (layer.id === id) {
      found = true;
      return update(layer);
    }
    if (layer.type === 'group') {
      const inner = mapLayers(layer.children, id, update);
      if (inner.found) {
        found = true;
        return { ...layer, children: inner.layers };
      }
    }
    return layer;
  });
  return { layers: next, found };
}

/** Every layer keeps a window of at least the minimum inside its groups' windows. */
function checkWindows(composition: CompositionV2): CompositionIssue[] {
  const durationMs = composition.durationMs ?? 0;
  const issues: CompositionIssue[] = [];
  const walk = (layers: readonly CompositionLayerV2[], start: number, end: number) => {
    for (const layer of layers) {
      const s = Math.max(start, layer.timing?.startMs ?? 0);
      const e = Math.min(end, layer.timing?.endMs ?? durationMs);
      if (layer.timing && e - s < TIMELINE_LIMITS.minWindowMs) {
        issues.push({
          path: `layers.${layer.id}.timing`,
          code: 'invalid-value',
          message: "The layer's window would not overlap its group's window.",
        });
      }
      if (layer.type === 'group') walk(layer.children, s, e);
    }
  };
  walk(composition.layers, 0, durationMs);
  return issues;
}

function editTiming(
  document: TimelineDocument,
  layerId: string,
  timing: LayerTiming | undefined
): TimelineEditResult {
  const { composition } = document;
  const mapped = mapLayers(composition.layers, layerId, (layer) => {
    const { timing: _old, ...rest } = layer;
    return (timing ? { ...rest, timing } : rest) as CompositionLayerV2;
  });
  if (!mapped.found) return fail('layerId', 'No layer or group has this id.', 'missing-field');
  const next: CompositionV2 = { ...composition, layers: mapped.layers };
  const issues = checkWindows(next);
  return issues.length > 0
    ? { ok: false, errors: issues }
    : { ok: true, document: { ...document, composition: next } };
}

function editTrack(
  document: TimelineDocument,
  layerId: string,
  edit: (keyframes: LayerKeyframe[]) => LayerKeyframe[] | TimelineEditResult
): TimelineEditResult {
  const { animation } = document;
  const existing = animation.tracks.find((track) => track.layerId === layerId);
  const edited = edit([...(existing?.keyframes ?? [])]);
  if (!Array.isArray(edited)) return edited;
  const keyframes = [...edited].sort((a, b) => a.timeMs - b.timeMs);
  const tracks = existing
    ? animation.tracks
        .map((track) => (track.layerId === layerId ? { ...track, keyframes } : track))
        .filter((track) => track.keyframes.length > 0)
    : [...animation.tracks, { layerId, keyframes }];
  // v1 animations need at least one track; the last keyframe cannot be removed.
  if (tracks.length === 0) {
    return fail('tracks', 'An animation keeps at least one keyframe.', 'missing-field');
  }
  const check = validateAnimationV2({ ...animation, tracks }, document.composition);
  return check.ok
    ? { ok: true, document: { ...document, animation: check.animation } }
    : { ok: false, errors: check.errors };
}

function keyframeAt(keyframes: readonly LayerKeyframe[], index: number) {
  return Number.isInteger(index) && index >= 0 && index < keyframes.length
    ? undefined
    : fail('index', 'No keyframe at this index.', 'missing-field');
}

/**
 * Apply one edit and return the new document, or the issues that refused it.
 * The input should be validated (`validateCompositionV2`, `validateAnimationV2`).
 * Every result stays valid: layer windows stay inside the timeline and their
 * groups' windows, and the edited animation passes `validateAnimationV2`
 * (sorted keyframes, value ranges, group tracks limited to opacity and
 * offset). Keyframe times must be unique on a track. The input is not mutated.
 */
export function applyTimelineAction(
  document: TimelineDocument,
  action: TimelineAction
): TimelineEditResult {
  switch (action.type) {
    case 'set-window': {
      const compositionMs = document.composition.durationMs;
      if (compositionMs === undefined) {
        return fail('durationMs', 'Layer windows need a composition durationMs.', 'missing-field');
      }
      const startError = wholeMs(action.startMs, 'startMs', 0, compositionMs - 1);
      if (startError) return startError;
      if (action.endMs !== undefined) {
        const endError = wholeMs(action.endMs, 'endMs', action.startMs + 1, compositionMs);
        if (endError) return endError;
      }
      // An end at the composition's end is the default; keep the document minimal.
      const endMs = action.endMs === compositionMs ? undefined : action.endMs;
      return editTiming(document, action.layerId, {
        startMs: action.startMs,
        ...(endMs === undefined ? {} : { endMs }),
      });
    }
    case 'clear-window':
      return editTiming(document, action.layerId, undefined);
    case 'add-keyframe': {
      const timeError = wholeMs(action.timeMs, 'timeMs', 0, document.animation.durationMs);
      if (timeError) return timeError;
      return editTrack(document, action.layerId, (keyframes) => {
        if (keyframes.some((keyframe) => keyframe.timeMs === action.timeMs)) {
          return fail('timeMs', 'This track already has a keyframe at that time.');
        }
        return [...keyframes, { ...(action.values ?? { opacity: 1 }), timeMs: action.timeMs }];
      });
    }
    case 'move-keyframe': {
      const timeError = wholeMs(action.timeMs, 'timeMs', 0, document.animation.durationMs);
      if (timeError) return timeError;
      return editTrack(document, action.layerId, (keyframes) => {
        const missing = keyframeAt(keyframes, action.index);
        if (missing) return missing;
        if (keyframes.some((k, i) => i !== action.index && k.timeMs === action.timeMs)) {
          return fail('timeMs', 'This track already has a keyframe at that time.');
        }
        return keyframes.map((k, i) => (i === action.index ? { ...k, timeMs: action.timeMs } : k));
      });
    }
    case 'update-keyframe':
      return editTrack(document, action.layerId, (keyframes) => {
        const missing = keyframeAt(keyframes, action.index);
        if (missing) return missing;
        return keyframes.map((k, i) =>
          i === action.index ? { ...k, ...action.values, timeMs: k.timeMs } : k
        );
      });
    case 'set-easing':
      return editTrack(document, action.layerId, (keyframes) => {
        const missing = keyframeAt(keyframes, action.index);
        if (missing) return missing;
        return keyframes.map((k, i) => (i === action.index ? { ...k, easing: action.easing } : k));
      });
    case 'remove-keyframe':
      return editTrack(document, action.layerId, (keyframes) => {
        const missing = keyframeAt(keyframes, action.index);
        if (missing) return missing;
        return keyframes.filter((_k, i) => i !== action.index);
      });
    default:
      return fail('type', 'Unknown timeline action.');
  }
}

export interface TimelineHistory {
  past: readonly TimelineDocument[];
  present: TimelineDocument;
  future: readonly TimelineDocument[];
  /** Consecutive actions with the same key replace one history entry (drags). */
  lastKey: string | null;
  /** Issues of the last refused action, cleared by the next accepted one. */
  errors: readonly CompositionIssue[];
}

export type TimelineHistoryAction =
  | { type: 'apply'; action: TimelineAction }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'replace'; document: TimelineDocument };

export function createTimelineHistory(present: TimelineDocument): TimelineHistory {
  return { past: [], present, future: [], lastKey: null, errors: [] };
}

function coalesceKey(action: TimelineAction): string | null {
  if (action.type === 'set-window') return `window:${action.layerId}`;
  if (action.type === 'move-keyframe') return `move:${action.layerId}:${action.index}`;
  if (action.type === 'update-keyframe') {
    return `update:${action.layerId}:${action.index}:${Object.keys(action.values).sort().join(',')}`;
  }
  return null;
}

/**
 * Undo/redo over timeline edits. A refused action leaves the document as it
 * was and records its issues in `errors`. Repeated drags of the same window or
 * keyframe merge into one undo step; history keeps at most 100 steps.
 */
export function timelineHistoryReducer(
  history: TimelineHistory,
  action: TimelineHistoryAction
): TimelineHistory {
  switch (action.type) {
    case 'apply': {
      const result = applyTimelineAction(history.present, action.action);
      if (!result.ok) return { ...history, errors: result.errors };
      if (JSON.stringify(result.document) === JSON.stringify(history.present)) {
        return history.errors.length > 0 ? { ...history, errors: [] } : history;
      }
      const key = coalesceKey(action.action);
      if (key !== null && key === history.lastKey) {
        return { ...history, present: result.document, future: [], errors: [] };
      }
      const past = [...history.past, history.present].slice(-TIMELINE_LIMITS.maxHistory);
      return { past, present: result.document, future: [], lastKey: key, errors: [] };
    }
    case 'undo': {
      const previous = history.past.at(-1);
      if (!previous) return history;
      return {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
        lastKey: null,
        errors: [],
      };
    }
    case 'redo': {
      const [next, ...future] = history.future;
      if (!next) return history;
      return {
        past: [...history.past, history.present],
        present: next,
        future,
        lastKey: null,
        errors: [],
      };
    }
    case 'replace':
      return createTimelineHistory(action.document);
    default:
      return history;
  }
}
