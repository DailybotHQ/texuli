/**
 * The print view's preload with the stage's default renderer tables (G81).
 * `preloadDeckPrintView()` warms the body, its slide painter and (unless
 * turned off) the default tables ahead of time, so a view mounted later (a
 * print route, a `beforeprint` handler) renders its pages on the first
 * render. The tables come through {@link DECK_PRINT_DEFAULTS}, which imports
 * the stage's loader on first use; a host that brings every renderer itself
 * uses `@texuli/slides/export-core` instead, which never references them
 * (G105).
 */
import type { DeckDefaultRenderersSource, DeckRenderers } from '../stage/renderers.ts';
import { preloadDeckPrintViewCore } from './print-preload-core.ts';

let tables: readonly DeckRenderers[] | undefined;

/**
 * The stage's default tables (the 20 catalog layouts and the component
 * registry) as the print view's defaults source, imported on first use.
 */
export const DECK_PRINT_DEFAULTS: DeckDefaultRenderersSource = Object.freeze({
  load: () =>
    import('../stage/defaults.ts')
      .then((module) => module.loadDefaultDeckRenderers())
      .then((loaded) => {
        tables = loaded;
        return loaded;
      }),
  loaded: () => tables,
});

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
export function preloadDeckPrintView(options: PreloadDeckPrintViewOptions = {}): Promise<void> {
  return preloadDeckPrintViewCore({
    defaults: DECK_PRINT_DEFAULTS,
    ...(options.defaultRenderers === false ? { defaultRenderers: false } : {}),
  });
}
