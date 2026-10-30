/**
 * Lazy list motion for the data views (G86). The Board, the DataGrid and the
 * Dashboard animate layout changes with `createListMotion` from
 * `texuli/motion`; this shim keeps that module (the seams, the contract and
 * the runtime loader behind it) out of their entries and loads it with
 * `import()` the first time a mounted list could animate a change. With
 * `motion={false}`, `layout: false`, level `none`, reduced motion (forced by
 * a `MotionProvider` or the reader's) or on the server, it never loads.
 *
 * Contract (the one `createListMotion` keeps): call it during component
 * init, `measure()` before the DOM changes (`$effect.pre`) and `play()` after
 * (`$effect`). The first pair (the mount) only records that the list is on
 * screen, so nothing animates on hydration. A change before the module has
 * loaded commits at once (no late flash), as a change before the runtime has
 * loaded always did.
 */

import { getContext } from 'svelte';
import type { ComponentMotion, MotionProp, MotionSettings } from 'texuli/motion';

type MotionModule = Pick<typeof import('texuli/motion'), 'createListMotion'>;
type ListMotion = ReturnType<MotionModule['createListMotion']>;

/**
 * The key `texuli/motion` registers its `MotionProvider` settings under
 * (`Symbol.for`, so every copy of the package shares it). Read here, at init,
 * because a component cannot read its context after `import()` resolves.
 */
const MOTION_CONTEXT = Symbol.for('texuli.motion');

/** No provider: full motion, the reader's preference decides reduced motion. */
const DEFAULT_SETTINGS: MotionSettings = { level: 'full', reducedMotion: undefined };

export interface LazyListMotionOptions {
  /** The component's `motion` prop (read at change time, so it stays live). */
  motion: () => MotionProp | null | undefined;
  /** The component's defaults. */
  defaults: ComponentMotion;
  /** The keyed elements of the list, in order. */
  items: () => Iterable<readonly [string, Element]>;
  /** Settings to use instead of the enclosing provider's (tests). */
  settings?: MotionSettings;
  /** Load `texuli/motion` (tests); defaults to `import('texuli/motion')`. */
  load?: () => Promise<MotionModule>;
}

export function createLazyListMotion(options: LazyListMotionOptions): {
  measure(): void;
  play(): void;
  cancel(): void;
} {
  const settings =
    options.settings ?? getContext<MotionSettings | undefined>(MOTION_CONTEXT) ?? DEFAULT_SETTINGS;
  const load = options.load ?? (() => import('texuli/motion'));
  let mounted = false;
  let list: ListMotion | null = null;
  let loading = false;

  /** Whether a layout change now could animate (browser only). */
  const animates = (): boolean => {
    if (typeof window === 'undefined') return false;
    if (settings.level === 'none' || settings.reducedMotion === true) return false;
    const prop = options.motion();
    if (prop === false) return false;
    const layout =
      prop && typeof prop === 'object' && typeof prop.layout === 'boolean'
        ? prop.layout
        : options.defaults.layout === true;
    if (!layout) return false;
    // The reader's preference, unless the provider ignores it.
    return (
      settings.reducedMotion === false ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches !== true
    );
  };

  const ensure = (): void => {
    if (list || loading || !animates()) return;
    loading = true;
    load().then(
      (module) => {
        const created = module.createListMotion({
          motion: options.motion,
          defaults: options.defaults,
          items: options.items,
          settings,
        });
        // The list is already on screen: this first play() records the mount.
        created.play();
        list = created;
      },
      () => {
        // Retried on the next change; until then changes commit at once.
        loading = false;
      }
    );
  };

  return {
    measure() {
      if (!mounted) return;
      if (list) list.measure();
      else ensure();
    },
    play() {
      if (!mounted) {
        mounted = true;
        ensure();
        return;
      }
      list?.play();
    },
    cancel() {
      list?.cancel();
    },
  };
}
