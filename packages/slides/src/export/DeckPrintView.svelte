<script lang="ts">
/**
 * Print view for deck model v2: one page per visible slide at the deck's
 * canvas size (a named `@page`), every reveal step shown, optional notes
 * pages, hidden slides skipped, and `data-print-ready="true"` once fonts,
 * images and the slide renderers have settled. See `DeckPrintViewProps`.
 *
 * This is `DeckPrintViewCore` with the stage's default tables as its
 * `defaults` (imported on first use, and only while `defaultRenderers` is
 * on). The body also loads on first use, so importing
 * `@texuli/slides/export` for PPTX or the print plan costs no print code;
 * `preloadDeckPrintView()` warms it (G81). Catalog themes load from the
 * token theme library when the host passes no `loadTheme`
 * (`loadDeckLibraryTheme`; the core has no default loader, G127).
 */
import { loadDeckLibraryTheme } from '../stage/library-theme.ts';
import DeckPrintViewCore from './DeckPrintViewCore.svelte';
import { DECK_PRINT_DEFAULTS } from './print-preload.ts';
import type { DeckPrintViewProps } from './print-types.ts';

let { loadTheme = loadDeckLibraryTheme, ...rest }: DeckPrintViewProps = $props();
</script>

<DeckPrintViewCore {...rest} {loadTheme} defaults={DECK_PRINT_DEFAULTS} />
