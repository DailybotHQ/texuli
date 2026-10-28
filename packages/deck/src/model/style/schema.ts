/**
 * `DeckStyle` (model v2 §3.1, §3.2): every field is optional. The schema
 * keeps the authored document as written (no defaults injected, so text
 * twins, patches and migration stay faithful); `DECK_STYLE_DEFAULTS` holds
 * the documented defaults and `resolveDeckStyle` applies them.
 */
import { type Infer, t } from '../../schema/index.ts';
import { deckBackground } from '../backgrounds/schema.ts';
import { DECK_ASPECTS, deckTransition, line, MEDIA_SRC_PATTERN } from '../shared.ts';
import { deckThemeReference, styleSlug } from './theme.ts';

export const DECK_DENSITIES = ['compact', 'default', 'comfortable', 'spacious'] as const;
export type DeckDensity = (typeof DECK_DENSITIES)[number];

export const DECK_RADII = ['none', 'small', 'medium', 'large', 'full'] as const;
export type DeckRadius = (typeof DECK_RADII)[number];

/** A ceiling: the host's reduced-motion preference only lowers it. */
export const DECK_MOTIONS = ['full', 'subtle', 'none'] as const;
export type DeckMotion = (typeof DECK_MOTIONS)[number];

export const DECK_PROGRESS = ['none', 'top', 'bottom'] as const;
export type DeckProgress = (typeof DECK_PROGRESS)[number];

/** `style.logo`: media syntax (an image), at most 512 code points. */
export const logoSrc = t.string({ min: 1, max: 512, pattern: MEDIA_SRC_PATTERN });

export const deckStyle = t.object(
  {
    theme: t.optional(deckThemeReference, {
      description: 'Catalog id or reference; absent → the host default theme.',
    }),
    fontPair: t.optional(styleSlug, {
      description: 'Font pairing id; unknown → warning, theme font.',
    }),
    aspect: t.optional(t.enum(DECK_ASPECTS), { description: "Default '16:9'." }),
    density: t.optional(t.enum(DECK_DENSITIES), {
      description: "Default 'default' (0.875 / 1 / 1.125 / 1.25).",
    }),
    radius: t.optional(t.enum(DECK_RADII), { description: "Default 'medium'." }),
    motion: t.optional(t.enum(DECK_MOTIONS), { description: "Default 'full'." }),
    transition: t.optional(deckTransition, { description: "Default 'fade'." }),
    background: t.optional(deckBackground, { description: "Default 'solid-color'." }),
    logo: t.optional(logoSrc),
    footer: t.optional(line(160)),
    slideNumbers: t.optional(t.boolean(), { description: 'Default true.' }),
    progress: t.optional(t.enum(DECK_PROGRESS), { description: "Default 'bottom'." }),
    codeTheme: t.optional(styleSlug, {
      description: 'Code highlight theme id; unknown → warning.',
    }),
    math: t.optional(t.boolean(), { description: 'Enables `$…$` TeX math. Default false.' }),
  },
  { description: 'Deck style: theme, typography, canvas, motion and chrome.' }
);
export type DeckStyle = Infer<typeof deckStyle>;

/** The documented defaults for every field that has one. */
export const DECK_STYLE_DEFAULTS = Object.freeze({
  aspect: '16:9',
  density: 'default',
  radius: 'medium',
  motion: 'full',
  transition: 'fade',
  background: 'solid-color',
  slideNumbers: true,
  progress: 'bottom',
  math: false,
} as const satisfies Required<
  Pick<
    DeckStyle,
    | 'aspect'
    | 'density'
    | 'radius'
    | 'motion'
    | 'transition'
    | 'background'
    | 'slideNumbers'
    | 'progress'
    | 'math'
  >
>);
