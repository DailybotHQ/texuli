/**
 * Lazy loaders for the live demos: one module per primitive in `demos/`,
 * named after its `@texuli/primitives/<id>` subpath. Each becomes its own
 * chunk, fetched only when the demo frame scrolls into view.
 */
import type { Component } from 'svelte';
import type { DemoProps, DemoSpec } from './types.ts';

export interface DemoModule {
  default: Component<DemoProps>;
  spec: DemoSpec;
}

// Client only: the server render shows the loading frame, and keeping the
// demos out of the server graph keeps their CSS off the page until a demo
// chunk loads (Vite then links that chunk's CSS on demand).
const DEMOS: Record<string, () => Promise<DemoModule>> = import.meta.env.SSR
  ? {}
  : import.meta.glob<DemoModule>('./demos/*.svelte');

const idOf = (path: string) => path.replace('./demos/', '').replace('.svelte', '');

/** Every primitive id that has a live demo. */
export const DEMO_IDS: readonly string[] = Object.keys(DEMOS).map(idOf).sort();

/** Load one demo module (rejects for an unknown id). */
export function loadDemo(id: string): Promise<DemoModule> {
  const loader = DEMOS[`./demos/${id}.svelte`];
  return loader ? loader() : Promise.reject(new Error(`No live demo for ${id}`));
}
