import type { Component } from 'svelte';
import type { LazyControlType, SchemaFormControl, SchemaFormProgressProps } from './types.ts';

/*
 * Per-type loaders (G119): each control is its own chunk with its own CSS.
 * A loaded control is kept, so the next form paints it at once.
 */

type Loader = () => Promise<{ default: SchemaFormControl }>;

const LOADERS: Readonly<Record<LazyControlType, Loader>> = {
  date: () => import('./DateControl.svelte'),
  time: () => import('./TimeControl.svelte'),
  datetime: () => import('./DateTimeControl.svelte'),
  slider: () => import('./SliderControl.svelte'),
  tags: () => import('./TagsControl.svelte'),
  file: () => import('./FileControl.svelte'),
  color: () => import('./ColorControl.svelte'),
  radio: () => import('./RadioControl.svelte'),
};

const loaded = new Map<LazyControlType, SchemaFormControl>();
const loading = new Map<LazyControlType, Promise<SchemaFormControl>>();

/** The control for a type if it already loaded. */
export function loadedControl(type: LazyControlType): SchemaFormControl | undefined {
  return loaded.get(type);
}

/** Load the control for a type (once; later calls share the same promise). */
export function loadControl(type: LazyControlType): Promise<SchemaFormControl> {
  const done = loaded.get(type);
  if (done) return Promise.resolve(done);
  let pending = loading.get(type);
  if (!pending) {
    pending = LOADERS[type]().then(
      (module) => {
        loaded.set(type, module.default);
        loading.delete(type);
        return module.default;
      },
      (cause: unknown) => {
        // A failed chunk may be retried by the next field that asks.
        loading.delete(type);
        throw cause;
      }
    );
    loading.set(type, pending);
  }
  return pending;
}

type Progress = Component<SchemaFormProgressProps>;
let progress: Progress | undefined;
let progressLoading: Promise<Progress> | undefined;

/** The step navigation if it already loaded. */
export function loadedProgress(): Progress | undefined {
  return progress;
}

/** Load the step navigation of multi-step forms (once). */
export function loadProgress(): Promise<Progress> {
  if (progress) return Promise.resolve(progress);
  progressLoading ??= import('./ProgressControl.svelte').then(
    (module) => {
      progress = module.default;
      return module.default;
    },
    (cause: unknown) => {
      progressLoading = undefined;
      throw cause;
    }
  );
  return progressLoading;
}
