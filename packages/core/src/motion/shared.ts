/**
 * Shared-element transitions (ADR-013): a keyed snapshot of one element's box
 * before a state change, played onto the element that represents the same
 * thing after it (a thumbnail and its lightbox, a card and its detail view).
 *
 * The fallback everywhere is FLIP: the new element moves and scales from the
 * captured box; when the old element is still on the page the two cross-fade.
 * {@link startScopedViewTransition} uses an element-scoped View Transition
 * when the browser has one and otherwise just applies the update.
 */

import {
  createRun,
  type MotionOutcome,
  type MotionRun,
  type MotionTiming,
  resolveMotion,
  startAnimation,
} from './animate.ts';
import { flipTransform } from './flip.ts';
import { resolveMotionLevel } from './preferences.ts';

type Snapshot = {
  readonly element: Element;
  readonly box: { left: number; top: number; width: number; height: number };
};

export type SharedElementsOptions = MotionTiming & {
  /** Snapshots kept at most; the oldest is dropped past it. Default 256 (clamped to [1, 4096]). */
  maxEntries?: number;
  onFinish?: (outcome: MotionOutcome) => void;
};

export type SharedElements = {
  /** Record where `element` is now under `key`. False when it cannot be measured (detached, SSR). */
  capture: (key: string, element: Element) => boolean;
  /** Animate `element` from the box captured under `key`, then forget the snapshot. */
  play: (key: string, element: Element) => MotionRun;
  has: (key: string) => boolean;
  release: (key: string) => void;
  clear: () => void;
  /** How many snapshots are held. */
  readonly size: number;
};

function measure(element: Element): Snapshot['box'] | null {
  if (!element?.isConnected || typeof element.getBoundingClientRect !== 'function') return null;
  const r = element.getBoundingClientRect();
  const box = { left: r.left, top: r.top, width: r.width, height: r.height };
  return Object.values(box).every(Number.isFinite) ? box : null;
}

/**
 * Create a registry of keyed snapshots.
 *
 * @example
 * const shared = createSharedElements({ duration: 250 });
 * shared.capture('photo-3', thumbnail);
 * openLightbox();                      // the DOM changes
 * shared.play('photo-3', lightboxImage);
 */
export function createSharedElements(options: SharedElementsOptions = {}): SharedElements {
  const limit = Math.max(
    1,
    Math.min(
      4096,
      Math.floor(Number.isFinite(options.maxEntries) ? (options.maxEntries as number) : 256)
    )
  );
  const snapshots = new Map<string, Snapshot>();

  return {
    capture(key, element) {
      const box = element ? measure(element) : null;
      const id = String(key);
      snapshots.delete(id);
      if (!box) return false;
      snapshots.set(id, { element, box });
      while (snapshots.size > limit) {
        const oldest = snapshots.keys().next().value;
        if (oldest === undefined) break;
        snapshots.delete(oldest);
      }
      return true;
    },

    play(key, element) {
      const id = String(key);
      const snapshot = snapshots.get(id);
      snapshots.delete(id);
      const last = element ? measure(element) : null;
      if (!snapshot || !last) {
        return createRun([], options.onFinish, last ? 'no-properties' : 'detached');
      }
      const transform = flipTransform(snapshot.box, last, true);
      const crossFade = snapshot.element !== element && snapshot.element.isConnected;
      const toFrames: Keyframe[] = [
        {
          transform: transform ?? 'none',
          transformOrigin: '0 0',
          ...(crossFade ? { opacity: 0 } : {}),
        },
        { transform: 'none', transformOrigin: '0 0', ...(crossFade ? { opacity: 1 } : {}) },
      ];
      if (!transform && !crossFade) return createRun([], options.onFinish, 'no-properties');

      // Read phase done; write phase.
      const plans: [Element, ReturnType<typeof resolveMotion>][] = [
        [element, resolveMotion(element, toFrames, options)],
      ];
      if (crossFade) {
        // The old element travels from its box onto the new one while it fades out.
        const travel = flipTransform(last, snapshot.box, true) ?? 'none';
        plans.push([
          snapshot.element,
          resolveMotion(
            snapshot.element,
            [
              { transform: 'none', transformOrigin: '0 0', opacity: 1 },
              { transform: travel, transformOrigin: '0 0', opacity: 0 },
            ],
            options
          ),
        ]);
      }
      const animations: Animation[] = [];
      let reason: MotionRun['instantReason'] = null;
      for (const [target, plan] of plans) {
        if (plan.instant) {
          reason ??= plan.reason;
          continue;
        }
        const animation = startAnimation(target, plan);
        if (animation) animations.push(animation);
        else reason ??= 'error';
      }
      return createRun(animations, options.onFinish, reason);
    },

    has: (key) => snapshots.has(String(key)),
    release: (key) => {
      snapshots.delete(String(key));
    },
    clear: () => snapshots.clear(),
    get size() {
      return snapshots.size;
    },
  };
}

type ViewTransitionLike = { finished: Promise<unknown> };
type ScopedViewTransitionHost = Element & {
  startViewTransition?: (update: () => void | Promise<void>) => ViewTransitionLike;
};

export type ScopedViewTransitionOptions = Pick<MotionTiming, 'level' | 'reducedMotion'>;

/**
 * Run `update` inside an element-scoped View Transition when the browser
 * offers `element.startViewTransition`; otherwise (no support, the server,
 * level `none`, reduced motion) apply it at once. Resolves `"finished"` after
 * the transition, `"instant"` when the update was applied directly.
 */
export async function startScopedViewTransition(
  scope: Element | null | undefined,
  update: () => void | Promise<void>,
  options: ScopedViewTransitionOptions = {}
): Promise<MotionOutcome> {
  const host = scope as ScopedViewTransitionHost | null | undefined;
  // Same gates as any animation (server, detached, level, reduced motion);
  // a missing Web Animations API does not matter here.
  const probe = resolveMotion(host ?? null, [{ opacity: 1 }], {
    level: resolveMotionLevel({ host: options.level }),
    reducedMotion: options.reducedMotion,
    duration: 1,
  });
  const usable = !probe.instant || probe.reason === 'no-waapi';
  if (!host || !usable || typeof host.startViewTransition !== 'function') {
    await update();
    return 'instant';
  }
  let transition: ViewTransitionLike;
  try {
    transition = host.startViewTransition.call(host, update);
  } catch {
    await update();
    return 'instant';
  }
  try {
    await transition.finished;
    return 'finished';
  } catch {
    return 'cancelled';
  }
}
