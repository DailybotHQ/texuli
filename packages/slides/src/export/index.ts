/**
 * `@texuli/slides/export`: print plans and flags, the PDF seam, PPTX (v1
 * synchronous, v2 loaded on first use), the owned XML and ZIP writers
 * (`api.ts`), and the v2 print view, which loads its body on first use and
 * paints with the stage's default renderer tables unless turned off. A host
 * that brings every renderer itself uses `@texuli/slides/export-core`
 * (`DeckPrintViewCore`), which never references those tables (G105).
 */
export * from './core.ts';
export { default as DeckPrintView } from './DeckPrintView.svelte';
export {
  DECK_PRINT_DEFAULTS,
  type PreloadDeckPrintViewOptions,
  preloadDeckPrintView,
} from './print-preload.ts';
