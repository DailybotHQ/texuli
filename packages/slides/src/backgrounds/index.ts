/**
 * Deck backgrounds on the stage. The stage already paints the layers (base
 * color, gradient or pattern, media, scrim) from `resolveDeckBackground`;
 * this module is what hosts, lint and tests use around it:
 *
 * - `deckBackgroundPaletteFor`: a token theme in a mode as the `#rrggbb`
 *   palette the resolver needs (the stage's `deckBackgroundPalette`).
 * - `deckBackgroundContrast`: every background resolved against a theme in a
 *   mode, with the worst-case text contrast the scrim guarantees, so a host
 *   or a test can prove the 4.5:1 floor for its themes.
 * - `DECK_BACKGROUND_GALLERY`: the 13 presets plus one spec of each kind,
 *   the catalog the backgrounds gallery example paints.
 */
import {
  DECK_BACKGROUND_PRESET_IDS,
  DECK_TEXT_CONTRAST_MIN,
  type DeckBackground,
  type DeckBackgroundPalette,
  type ResolvedDeckBackground,
  resolveDeckBackground,
} from '@texuli/deck/model';
import type { Theme } from '@texuli/tokens/contract';
import type { ResolvedColorMode } from '@texuli/tokens/modes';
import { deckBackgroundPalette } from '../stage/style.ts';

/** A tiny PNG (one pixel) for gallery and test media backgrounds. */
const SWATCH =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export interface DeckBackgroundGalleryEntry {
  /** A slide id for the gallery deck. */
  id: string;
  label: string;
  background: DeckBackground;
}

/** The 13 presets, then one spec of each kind (solid hex, angled gradient, image, video). */
export const DECK_BACKGROUND_GALLERY: readonly DeckBackgroundGalleryEntry[] = Object.freeze([
  ...DECK_BACKGROUND_PRESET_IDS.map((id) => ({
    id: `bg-${id}`,
    label: id,
    background: id as DeckBackground,
  })),
  {
    id: 'bg-spec-solid-color',
    label: 'solid #0f766e',
    background: { kind: 'solid', color: '#0f766e' } as DeckBackground,
  },
  {
    id: 'bg-spec-gradient',
    label: 'gradient dusk, 45°',
    background: { kind: 'gradient', gradient: 'dusk', angle: 45 } as DeckBackground,
  },
  {
    id: 'bg-spec-image',
    label: 'image, light tone',
    background: { kind: 'image', src: SWATCH, tone: 'light', fit: 'cover' } as DeckBackground,
  },
  {
    id: 'bg-spec-image-full',
    label: 'full image, dark tone',
    background: { kind: 'image-full', src: SWATCH, tone: 'dark', overlay: 0.3 } as DeckBackground,
  },
]);

/** A theme's background palette in a mode (high contrast falls back to the neutral palette). */
export function deckBackgroundPaletteFor(
  theme: Pick<Theme, 'light' | 'dark'> | null | undefined,
  mode: ResolvedColorMode
): DeckBackgroundPalette {
  return deckBackgroundPalette(theme, mode);
}

export interface DeckBackgroundContrastEntry {
  background: DeckBackground;
  resolved: ResolvedDeckBackground;
  /** The worst-case text contrast over the background and its scrim. */
  contrast: number;
  /** `contrast >= DECK_TEXT_CONTRAST_MIN` (4.5). */
  passes: boolean;
}

/** Resolve backgrounds (the gallery by default) against a theme in a mode. */
export function deckBackgroundContrast(
  theme: Pick<Theme, 'light' | 'dark'> | null | undefined,
  mode: ResolvedColorMode,
  backgrounds: readonly DeckBackground[] = DECK_BACKGROUND_GALLERY.map((entry) => entry.background)
): DeckBackgroundContrastEntry[] {
  const palette = deckBackgroundPaletteFor(theme, mode);
  return backgrounds.map((background) => {
    const resolved = resolveDeckBackground(background, palette);
    return {
      background,
      resolved,
      contrast: resolved.contrast,
      passes: resolved.contrast >= DECK_TEXT_CONTRAST_MIN,
    };
  });
}
