/**
 * The print view's lazy parts and their preload, without the default
 * renderer tables (G81, G105). `DeckPrintViewCore` imports its body on
 * first use; `preloadDeckPrintViewCore()` warms the body, its slide painter
 * and, when the host hands it a `defaults` source, those tables, so a view
 * mounted later renders its pages on the first render and only waits for
 * themes, images and fonts. Nothing here references the stage's default
 * tables, so a host on `@texuli/slides/export-core` emits none of their
 * chunks or CSS. Every import is shared with the view: nothing loads twice.
 */
import type { Component } from 'svelte';
import type { DeckDefaultRenderersSource } from '../stage/renderers.ts';
import type { DeckPrintViewCoreProps } from './print-types.ts';

type Body = Component<DeckPrintViewCoreProps>;

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

export interface PreloadDeckPrintViewCoreOptions {
  /**
   * The default tables to warm with the view (the same source the view is
   * given). Without it only the body and the painter load.
   */
  defaults?: DeckDefaultRenderersSource;
  /** Warm `defaults` too. Default true; `false` skips them. */
  defaultRenderers?: boolean;
}

/**
 * Warm everything `DeckPrintViewCore` imports on first use: its body, the
 * slide painter and, when given, the `defaults` tables. Resolves once they
 * have loaded; rejects if one fails (the view retries on mount). Safe to
 * call more than once.
 */
export async function preloadDeckPrintViewCore(
  options: PreloadDeckPrintViewCoreOptions = {}
): Promise<void> {
  await Promise.all([
    loadDeckPrintBody(),
    import('./print-paint.ts'),
    options.defaultRenderers === false || !options.defaults ? undefined : options.defaults.load(),
  ]);
}
