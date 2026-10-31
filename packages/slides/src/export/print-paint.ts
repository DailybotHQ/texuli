/**
 * The print view's default slide renderer, loaded on first use: the stage's
 * own `DeckSlidePreview` (the same layouts, component registry, backgrounds
 * and step context) with every theme the deck references resolved, so a
 * printed page is the slide the stage paints at its last step. The default
 * tables come from the `defaults` source the view is given (G105): the
 * export core passes none, so this module never references them, and
 * `DeckPrintView` passes a source that imports them on first use.
 */
import type { Deck, DeckSlide } from '@texuli/deck/model';
import { resolveDeckStyle } from '@texuli/deck/model';
import type { Theme } from '@texuli/tokens/contract';
import type { DeckMediaTrust } from '../stage/media.ts';
import { createDeckTranslator, type DeckStageMessages } from '../stage/messages.ts';
import DeckSlidePreview from '../stage/presenter/DeckSlidePreview.svelte';
import type { DeckPreviewPaint } from '../stage/presenter/paint.ts';
import {
  type DeckDefaultRenderersSource,
  type DeckRenderers,
  deckRendererList,
} from '../stage/renderers.ts';
import {
  deckBackgroundPalette,
  deckThemeKey,
  deckThemeReferences,
  loadDeckTheme,
  slideThemeReference,
} from '../stage/style.ts';
import { type DeckThemeLoader, deckThemeVariables, loadDeckLibraryTheme } from '../stage/theme.ts';
import { DECK_EXPORT_CANVAS, isDeckExportAspect } from './canvas.ts';

export { DeckSlidePreview };

export interface DeckPrintPaintOptions {
  renderers?: DeckRenderers | readonly DeckRenderers[];
  /**
   * Append the default tables from `defaults` after `renderers`. Default
   * true; `false` never loads them. Without `defaults` there is nothing to
   * append, as if this were `false`.
   */
  defaultRenderers?: boolean;
  /** Where the default tables come from (`DeckPrintView` passes the stage's). */
  defaults?: DeckDefaultRenderersSource;
  tier?: DeckMediaTrust;
  messages?: DeckStageMessages;
  /** Catalog theme loader; `null` leaves catalog themes to host CSS. */
  loadTheme?: DeckThemeLoader | null;
  resolveAvatar?: (id: string) => string | undefined;
}

export interface DeckPrintPaint {
  paint: DeckPreviewPaint;
  /** `--tx-deck-*` variables of the deck style (density, radius, canvas). */
  styleVars: Record<string, string>;
  /** `--tx-*` theme variables for one slide's page (empty when its theme is unknown). */
  themeVars(slide: DeckSlide): Record<string, string>;
  /** The slide title the page is labelled with. */
  title(slide: DeckSlide, position: number): string;
}

type PrintMode = 'light' | 'dark' | 'high-contrast';

/** Paper defaults to light: a `system` or missing mode prints light; explicit modes hold. */
function printMode(mode: string | undefined): PrintMode {
  return mode === 'dark' || mode === 'high-contrast' ? mode : 'light';
}

export async function createDeckPrintPaint(
  deck: Deck,
  options: DeckPrintPaintOptions = {}
): Promise<DeckPrintPaint> {
  const loader = options.loadTheme === undefined ? loadDeckLibraryTheme : options.loadTheme;
  const themes = new Map<string, Theme | null>();
  await Promise.all(
    deckThemeReferences(deck).map(async (reference) => {
      const key = deckThemeKey(reference);
      if (key) themes.set(key, await loadDeckTheme(reference, loader));
    })
  );
  const themeOf = (slide: DeckSlide | undefined) => {
    const reference = slideThemeReference(deck, slide);
    const key = deckThemeKey(reference);
    return { reference, theme: key ? (themes.get(key) ?? null) : null };
  };
  const aspect = isDeckExportAspect(deck.style?.aspect) ? deck.style.aspect : '16:9';
  const t = createDeckTranslator(options.messages);
  const defaults =
    options.defaultRenderers === false || !options.defaults
      ? []
      : (options.defaults.loaded() ?? (await options.defaults.load()));
  const renderers = [...deckRendererList(options.renderers), ...defaults];
  const paint: DeckPreviewPaint = {
    deck,
    renderers,
    tier: options.tier ?? 'untrusted',
    t,
    canvas: { ...DECK_EXPORT_CANVAS[aspect] },
    resolveAvatar: options.resolveAvatar,
    palette(slide) {
      const { reference, theme } = themeOf(slide);
      return deckBackgroundPalette(theme, printMode(reference?.mode));
    },
  };
  const style = resolveDeckStyle(deck.style, { reducedMotion: true });
  return {
    paint,
    styleVars: { ...style.cssVars },
    themeVars(slide) {
      const { reference, theme } = themeOf(slide);
      return theme
        ? deckThemeVariables(theme, printMode(reference?.mode), { reducedMotion: true })
        : {};
    },
    title(slide, position) {
      if (slide.title) return slide.title;
      const props = (slide as { props?: unknown }).props;
      const fromProps =
        props && typeof props === 'object' ? (props as { title?: unknown }).title : undefined;
      if (typeof fromProps === 'string' && fromProps.trim()) return fromProps;
      return t('stage.untitledSlide', { current: position + 1 });
    },
  };
}
