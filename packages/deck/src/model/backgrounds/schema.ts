/**
 * Deck backgrounds (model v2 §3.5), ported from Protoyard: 13 presets and a
 * spec union (`solid`, `gradient`, `pattern`, `image`/`image-full`,
 * `video`/`video-full`). Colors come only from the caller's palette, from a
 * validated `#rrggbb`, or from numbers computed in `resolve.ts`, so no author
 * string ever reaches CSS. iframe backgrounds are not part of the model.
 *
 * Media sources are checked for syntax here (`MEDIA_SRC_PATTERN`, plus the
 * image/video kind rule below); the stage applies the URL policy at the
 * host's trust tier when it paints.
 */
import { type Infer, t } from '../../schema/index.ts';
import { line, MEDIA_SRC_PATTERN, mediaSrc } from '../shared.ts';

/** The background diagnostic codes this module raises. */
export const BACKGROUND_CODES = Object.freeze({
  unknownBackground: 'unknown-background',
  solidConflict: 'solid-conflict',
  mediaKind: 'media-kind',
  invalidPaletteColor: 'invalid-palette-color',
} as const);

/**
 * The palette a background reads: semantic role → color. Role names mirror
 * `SEMANTIC_ROLES` in `@texuli/tokens` (the stage passes the active theme's
 * resolved roles, converted to hex). `inverse` is not a Texuli role; it
 * defaults to `foreground`. Values are `#rgb`/`#rrggbb` or `rgb()`/`rgba()`
 * (composited over `background`); an unreadable value is replaced and
 * reported (`invalid-palette-color`), never guessed at.
 */
export const DECK_PALETTE_ROLES = [
  'background',
  'foreground',
  'surface',
  'primary',
  'accent',
  'muted',
  'border',
  'info',
  'success',
  'warning',
  'destructive',
] as const;
export type DeckPaletteRole = (typeof DECK_PALETTE_ROLES)[number];

export type DeckBackgroundPalette = { readonly [R in DeckPaletteRole]: string } & {
  /** Defaults to `foreground`. */
  readonly inverse?: string;
};

/** Palette roles a `solid` background may name (`background` is the theme page color). */
export const DECK_SOLID_TOKENS = [
  'background',
  'surface',
  'primary',
  'accent',
  'muted',
  'inverse',
] as const;
export type DeckSolidToken = (typeof DECK_SOLID_TOKENS)[number];

/** Gradient stops, as palette roles (Protoyard's five). */
export const DECK_GRADIENTS = Object.freeze({
  brand: ['primary', 'info'],
  dusk: ['foreground', 'primary'],
  dawn: ['warning', 'destructive'],
  forest: ['success', 'info'],
  mist: ['muted', 'accent', 'surface'],
} as const satisfies Record<string, readonly DeckPaletteRole[]>);
export type DeckGradient = keyof typeof DECK_GRADIENTS;
export const DECK_GRADIENT_IDS = ['brand', 'dusk', 'dawn', 'forest', 'mist'] as const;

export const DECK_PATTERNS = ['dots', 'grid'] as const;
export type DeckPattern = (typeof DECK_PATTERNS)[number];

export const DECK_MEDIA_TONES = ['dark', 'light'] as const;
export const DECK_MEDIA_FITS = ['cover', 'contain'] as const;
export const DECK_MEDIA_POSITIONS = ['center', 'top', 'bottom', 'left', 'right'] as const;

/** The default gradient angle, in degrees. */
export const DECK_GRADIENT_ANGLE = 135;

/** `#rrggbb` (any case) for `solid {color}`; normalized to lowercase when resolved. */
export const HEX_COLOR_PATTERN = '^#[0-9a-fA-F]{6}$';

/** True when a media source is the right kind (`data:` type, avatars are images). */
function mediaFits(src: string, kind: 'image' | 'video'): boolean {
  if (src.startsWith('avatar:')) return kind === 'image';
  if (src.startsWith('data:')) return src.startsWith(`data:${kind}/`);
  return true;
}

const solidSpec = t.refine(
  t.object({
    kind: t.literal('solid'),
    token: t.optional(t.enum(DECK_SOLID_TOKENS)),
    color: t.optional(t.string({ pattern: HEX_COLOR_PATTERN, max: 7 })),
  }),
  {
    code: BACKGROUND_CODES.solidConflict,
    description: '`token` and `color` are mutually exclusive; neither means `background`.',
    check(value, context) {
      if (value.token !== undefined && value.color !== undefined) {
        context.issue({
          message: 'A solid background takes a palette `token` or a hex `color`, not both.',
          path: ['color'],
          fix: 'Remove `token` or `color`.',
        });
      }
    },
  }
);

const gradientSpec = t.object({
  kind: t.literal('gradient'),
  gradient: t.enum(DECK_GRADIENT_IDS),
  angle: t.optional(t.int({ min: 0, max: 359 })),
});

const patternSpec = t.object({
  kind: t.literal('pattern'),
  pattern: t.enum(DECK_PATTERNS),
});

const mediaShape = {
  tone: t.optional(t.enum(DECK_MEDIA_TONES)),
  overlay: t.optional(t.number({ min: 0, max: 0.9 })),
  position: t.optional(t.enum(DECK_MEDIA_POSITIONS)),
} as const;

/** A poster is always an image: `MEDIA_SRC_PATTERN`, at most 2,000,000 code points. */
const posterSrc = t.string({ min: 1, max: 2_000_000, pattern: MEDIA_SRC_PATTERN });

const imageSpec = t.refine(
  t.object({
    kind: t.enum(['image', 'image-full']),
    src: mediaSrc,
    alt: t.optional(line(200)),
    fit: t.optional(t.enum(DECK_MEDIA_FITS)),
    ...mediaShape,
  }),
  {
    code: BACKGROUND_CODES.mediaKind,
    description: 'An image `src` is not a `data:video/…` URI.',
    check(value, context) {
      if (!mediaFits(value.src, 'image')) {
        context.issue({
          message: 'An image background needs an image source.',
          path: ['src'],
          fix: 'Use an image path, a `data:image/…` URI or an avatar, or `kind: "video"`.',
        });
      }
    },
  }
);

const videoSpec = t.refine(
  t.object({
    kind: t.enum(['video', 'video-full']),
    src: mediaSrc,
    poster: t.optional(posterSrc),
    ...mediaShape,
  }),
  {
    code: BACKGROUND_CODES.mediaKind,
    description: 'A video `src` is not an image `data:` URI or an avatar; a `poster` is an image.',
    check(value, context) {
      if (!mediaFits(value.src, 'video')) {
        context.issue({
          message: 'A video background needs a video source.',
          path: ['src'],
          fix: 'Use a video path or a `data:video/…` URI, or `kind: "image"`.',
        });
      }
      if (value.poster !== undefined && !mediaFits(value.poster, 'image')) {
        context.issue({
          message: 'A video poster must be an image.',
          path: ['poster'],
          fix: 'Use an image path, a `data:image/…` URI or an avatar.',
        });
      }
    },
  }
);

/** A background spec (the object form), told apart by `kind`. */
export const deckBackgroundSpec = t.union(
  [solidSpec, gradientSpec, patternSpec, imageSpec, videoSpec],
  {
    discriminator: 'kind',
    code: BACKGROUND_CODES.unknownBackground,
    description: 'A background spec: solid, gradient, pattern, image(-full) or video(-full).',
  }
);
export type DeckBackgroundSpec = Infer<typeof deckBackgroundSpec>;
export type DeckBackgroundKind = DeckBackgroundSpec['kind'];

/** The 13 presets, each a spec. */
export const DECK_BACKGROUND_PRESETS = Object.freeze({
  'solid-color': Object.freeze({ kind: 'solid', token: 'background' }),
  'solid-surface': Object.freeze({ kind: 'solid', token: 'surface' }),
  'solid-primary': Object.freeze({ kind: 'solid', token: 'primary' }),
  'solid-accent': Object.freeze({ kind: 'solid', token: 'accent' }),
  'solid-muted': Object.freeze({ kind: 'solid', token: 'muted' }),
  'solid-inverse': Object.freeze({ kind: 'solid', token: 'inverse' }),
  'gradient-brand': Object.freeze({ kind: 'gradient', gradient: 'brand' }),
  'gradient-dusk': Object.freeze({ kind: 'gradient', gradient: 'dusk' }),
  'gradient-dawn': Object.freeze({ kind: 'gradient', gradient: 'dawn' }),
  'gradient-forest': Object.freeze({ kind: 'gradient', gradient: 'forest' }),
  'gradient-mist': Object.freeze({ kind: 'gradient', gradient: 'mist' }),
  'pattern-dots': Object.freeze({ kind: 'pattern', pattern: 'dots' }),
  'pattern-grid': Object.freeze({ kind: 'pattern', pattern: 'grid' }),
} as const satisfies Record<string, DeckBackgroundSpec>);
export type DeckBackgroundPresetId = keyof typeof DECK_BACKGROUND_PRESETS;
export const DECK_BACKGROUND_PRESET_IDS = [
  'solid-color',
  'solid-surface',
  'solid-primary',
  'solid-accent',
  'solid-muted',
  'solid-inverse',
  'gradient-brand',
  'gradient-dusk',
  'gradient-dawn',
  'gradient-forest',
  'gradient-mist',
  'pattern-dots',
  'pattern-grid',
] as const satisfies readonly DeckBackgroundPresetId[];

export const DEFAULT_DECK_BACKGROUND: DeckBackgroundPresetId = 'solid-color';

/** A preset id; an unknown id is the error `unknown-background` (v2; Protoyard only warned). */
export const deckBackgroundPreset = t.enum(DECK_BACKGROUND_PRESET_IDS, {
  code: BACKGROUND_CODES.unknownBackground,
  description: 'A background preset id.',
});

/** `style.background` and `slides[].background`: a preset id or a spec. */
export const deckBackground = t.union([deckBackgroundPreset, deckBackgroundSpec], {
  description: 'A background preset id, or a background spec object.',
});
export type DeckBackground = Infer<typeof deckBackground>;

/** True for one of the 13 preset ids (own keys only; `__proto__` and friends are not presets). */
export function isDeckBackgroundPreset(value: unknown): value is DeckBackgroundPresetId {
  return typeof value === 'string' && Object.hasOwn(DECK_BACKGROUND_PRESETS, value);
}
