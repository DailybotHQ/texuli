/**
 * The print view's lazy parts and their preload (G81). `DeckPrintView`
 * imports its body on first use; `preloadDeckPrintView()` warms the body,
 * its slide painter and (unless turned off) the default renderer tables
 * ahead of time, so a view mounted later (a print route, a `beforeprint`
 * handler) renders its pages on the first render and only waits for
 * themes, images and fonts. Every import is shared with the view: nothing
 * loads twice.
 */
import type { Component } from 'svelte';
import type { DeckPrintViewProps } from './print-types.ts';

type Body = Component<DeckPrintViewProps>;

let body: Body | undefined;
let bodyLoading: Promise<Body> | undefined;

/** Import the print view's body once (a failed import is retried by the next call). */
export function loadDeckPrintBody(): Promise<Body> {
  if (body) return Promise.resolve(body);
  bodyLoading ??= import('./DeckPrintPages.svelte').then(
    (module) => {
      body = module.default as Body;
      return body;
    },
    (error: unknown) => {
      bodyLoading = undefined;
      throw error;
    }
  );
  return bodyLoading;
}

/** The body when it has already loaded, synchronously. */
export function loadedDeckPrintBody(): Body | undefined {
  return body;
}

export interface PreloadDeckPrintViewOptions {
  /**
   * Also warm the default renderer tables (the 20 catalog layouts and the
   * component registry). Default true; pass `false` when the view runs with
   * `defaultRenderers={false}` or a `slide` snippet, so they never load.
   */
  defaultRenderers?: boolean;
}

/**
 * Warm everything `DeckPrintView` imports on first use: its body, the slide
 * painter and, by default, the default renderer tables. Resolves once they
 * have loaded; rejects if one fails (the view retries on mount). Safe to
 * call more than once.
 */
export async function preloadDeckPrintView(
  options: PreloadDeckPrintViewOptions = {}
): Promise<void> {
  await Promise.all([
    loadDeckPrintBody(),
    import('./print-paint.ts'),
    options.defaultRenderers === false
      ? undefined
      : import('../stage/defaults.ts').then((module) => module.loadDefaultDeckRenderers()),
  ]);
}
