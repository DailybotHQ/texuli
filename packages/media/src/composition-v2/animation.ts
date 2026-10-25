import { sampleComposition } from '../animation/sample.ts';
import type {
  AnimationValidation,
  CompositionAnimation,
  LayerTrack,
  SampleAnimationOptions,
} from '../animation/types.ts';
import { validateAnimation } from '../animation/validate.ts';
import type {
  Composition,
  CompositionIssue,
  CompositionLayer,
} from '../composition-model/types.ts';
import { type GroupState, resolveCompositionAt } from './resolve.ts';
import type { CompositionLayerV2, CompositionV2, GroupLayer } from './types.ts';

/** Keyframe fields a group track may set: its opacity and its offset (translate). */
const GROUP_KEYFRAME_KEYS = new Set(['timeMs', 'easing', 'opacity', 'translateX', 'translateY']);

function collect(
  layers: readonly CompositionLayerV2[],
  groups: GroupLayer[],
  leaves: CompositionLayer[]
) {
  for (const layer of layers) {
    if (layer.type === 'group') {
      groups.push(layer);
      collect(layer.children, groups, leaves);
    } else {
      const { timing: _timing, ...leaf } = layer as CompositionLayer & { timing?: unknown };
      leaves.push(leaf as CompositionLayer);
    }
  }
}

/**
 * Each group as a stand-in v1 shape layer, so v1 sampling (easing, keyframe
 * fill-forward) runs unchanged: its opacity is the group opacity and its
 * translate is the group offset.
 */
function groupProxies(composition: CompositionV2, groups: readonly GroupLayer[]): Composition {
  return {
    version: 1,
    width: composition.width,
    height: composition.height,
    layers: groups.map((group) => ({
      id: group.id,
      type: 'shape',
      shape: 'rectangle',
      frame: { x: 0, y: 0, width: 1, height: 1 },
      fill: { kind: 'solid', color: '#000000' },
      ...(group.opacity === undefined ? {} : { opacity: group.opacity }),
      transform: { translateX: group.offset?.x ?? 0, translateY: group.offset?.y ?? 0 },
    })),
  };
}

function split(composition: CompositionV2) {
  const groups: GroupLayer[] = [];
  const leaves: CompositionLayer[] = [];
  collect(composition.layers, groups, leaves);
  return { groups, leaves };
}

/**
 * Validate an animation against a v2 composition. Leaf tracks are checked
 * like v1 tracks against the leaf they target. A group track may animate only
 * `opacity`, `translateX` and `translateY` (the group offset); any other field
 * fails. Every track must name an existing layer or group.
 */
export function validateAnimationV2(
  input: unknown,
  composition: CompositionV2
): AnimationValidation {
  const base = validateAnimation(input);
  if (!base.ok) return base;
  const { groups, leaves } = split(composition);
  const groupIds = new Set(groups.map((group) => group.id));
  const errors: CompositionIssue[] = [];
  const leafTracks: LayerTrack[] = [];
  const leafIndex: number[] = [];
  base.animation.tracks.forEach((track, index) => {
    if (!groupIds.has(track.layerId)) {
      leafTracks.push(track);
      leafIndex.push(index);
      return;
    }
    track.keyframes.forEach((keyframe, frame) => {
      for (const [key, value] of Object.entries(keyframe)) {
        if (value !== undefined && !GROUP_KEYFRAME_KEYS.has(key)) {
          errors.push({
            path: `tracks[${index}].keyframes[${frame}].${key}`,
            code: 'invalid-value',
            message: 'Group tracks animate only opacity, translateX and translateY.',
          });
        }
      }
    });
  });
  // v1 requires at least one track; an all-group animation has no leaf tracks.
  const leafCheck =
    leafTracks.length === 0
      ? base
      : validateAnimation(
          { ...base.animation, tracks: leafTracks },
          {
            composition: {
              version: 1,
              width: composition.width,
              height: composition.height,
              layers: leaves,
            },
          }
        );
  if (!leafCheck.ok) {
    for (const error of leafCheck.errors) {
      // Report leaf-track errors at the track's index in the original animation.
      const path = error.path.replace(
        /^tracks\[(\d+)\]/,
        (_match, index: string) => `tracks[${leafIndex[Number(index)] ?? index}]`
      );
      errors.push({ ...error, path });
    }
  }
  return errors.length > 0 ? { ok: false, errors: errors.slice(0, 64) } : base;
}

/** The clock both layer windows and keyframes read, matching v1 sampling. */
function animationTime(
  animation: CompositionAnimation,
  timeMs: number,
  options: SampleAnimationOptions
): number {
  const duration = animation.durationMs;
  if (options.reducedMotion === true) {
    return Math.min(Math.max(options.stillTimeMs ?? 0, 0), duration);
  }
  const time = Number.isFinite(timeMs) ? timeMs : 0;
  if (animation.loop === true && duration > 0) return ((time % duration) + duration) % duration;
  return Math.min(Math.max(time, 0), duration);
}

/**
 * The animated flat v1 scene at `timeMs`: group tracks set group opacity and
 * offset, layer windows decide what is on screen, and leaf tracks animate the
 * leaves, all on one clock. Under `reducedMotion` everything freezes at
 * `stillTimeMs` (default 0), like v1 sampling. Validate both inputs first
 * (`validateCompositionV2`, `validateAnimationV2`).
 */
export function sampleCompositionV2(
  composition: CompositionV2,
  animation: CompositionAnimation,
  timeMs: number,
  options: SampleAnimationOptions = {}
): Composition {
  const time = animationTime(animation, timeMs, options);
  const { groups } = split(composition);
  const groupIds = new Set(groups.map((group) => group.id));
  const groupTracks = animation.tracks.filter((track) => groupIds.has(track.layerId));
  const states = new Map<string, GroupState>();
  if (groupTracks.length > 0) {
    const sampled = sampleComposition(
      groupProxies(composition, groups),
      { ...animation, loop: false, tracks: groupTracks },
      time
    );
    for (const proxy of sampled.layers) {
      states.set(proxy.id, {
        opacity: proxy.opacity ?? 1,
        offsetX: proxy.transform?.translateX ?? 0,
        offsetY: proxy.transform?.translateY ?? 0,
      });
    }
  }
  const snapshot = resolveCompositionAt(composition, time, states);
  return sampleComposition(
    snapshot,
    {
      ...animation,
      loop: false,
      tracks: animation.tracks.filter((track) => !groupIds.has(track.layerId)),
    },
    time
  );
}
