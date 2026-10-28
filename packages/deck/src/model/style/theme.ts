/**
 * Theme references (model v2 §3.8). A deck names its theme and the stage
 * resolves it with `@texuli/tokens`; this L0 module only defines the data:
 *
 * - `catalog`: a Texuli library theme id (the string shorthand means this);
 * - `embedded`: a theme object, bounded JSON here, validated by the stage
 *   with `defineTheme` (its errors become issues there);
 * - `seed`: Protoyard's `paletteSeed`, a uint32 the stage turns into a
 *   generated theme.
 *
 * `mode` comes from the reference, else the host, else `light` (so exports
 * are deterministic). `system` defers to the host.
 */
import { type Infer, t } from '../../schema/index.ts';

export const DECK_THEME_MODES = ['light', 'dark', 'high-contrast', 'system'] as const;
export type DeckThemeMode = (typeof DECK_THEME_MODES)[number];
/** A concrete mode (what `system` and an absent mode become). */
export type DeckResolvedThemeMode = Exclude<DeckThemeMode, 'system'>;

/** Theme, font-pair and code-theme ids: lowercase slugs, 1 to 64 characters. */
export const STYLE_SLUG_PATTERN = '^[a-z0-9][a-z0-9-]{0,63}$';
export const styleSlug = t.string({ pattern: STYLE_SLUG_PATTERN, max: 64 });

/** The largest seed (`0xffffffff`). */
export const DECK_THEME_SEED_MAX = 0xffff_ffff;

/** Limits for an embedded theme: generous for a full `ThemeInput`, bounded for hostile input. */
export const EMBEDDED_THEME_LIMITS = Object.freeze({
  depth: 6,
  maxKeys: 100,
  maxItems: 64,
  maxString: 512,
});

export const THEME_CODES = Object.freeze({
  unknownThemeKind: 'unknown-theme-kind',
  embeddedTheme: 'embedded-theme',
  unknownTheme: 'unknown-theme',
} as const);

const mode = t.optional(t.enum(DECK_THEME_MODES));

const catalogTheme = t.object({
  kind: t.literal('catalog'),
  id: styleSlug,
  mode,
});

const embeddedTheme = t.object({
  kind: t.literal('embedded'),
  theme: t.refine(t.json({ ...EMBEDDED_THEME_LIMITS, text: 'line' }), {
    code: THEME_CODES.embeddedTheme,
    description: 'An embedded theme is a JSON object (validated by the stage with defineTheme).',
    check(value, context) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        context.issue({
          message: 'An embedded theme must be an object.',
          fix: 'Pass a theme object, or use { kind: "catalog", id } for a library theme.',
        });
      }
    },
  }),
  mode,
});

const seedTheme = t.object({
  kind: t.literal('seed'),
  seed: t.int({ min: 0, max: DECK_THEME_SEED_MAX }),
  mode,
});

/** The object form of a theme reference, told apart by `kind`. */
export const deckThemeObject = t.union([catalogTheme, embeddedTheme, seedTheme], {
  discriminator: 'kind',
  code: THEME_CODES.unknownThemeKind,
  description: 'A theme reference: catalog id, embedded theme or palette seed.',
});
export type DeckThemeReference = Infer<typeof deckThemeObject>;

/** `style.theme` and `slides[].theme`: a catalog id shorthand or a reference object. */
export const deckThemeReference = t.union([styleSlug, deckThemeObject], {
  description: 'A theme: a catalog id (shorthand), or a reference object.',
});
export type DeckThemeInput = Infer<typeof deckThemeReference>;

/** The object form of a validated reference (a string becomes `{ kind: 'catalog', id }`). */
export function normalizeThemeReference(
  reference: DeckThemeInput | undefined
): DeckThemeReference | undefined {
  if (reference === undefined) return undefined;
  if (typeof reference === 'string') return { kind: 'catalog', id: reference };
  return { ...reference };
}

/** The mode a deck renders in: the reference's, else the host's, else `light`. */
export function resolveThemeMode(
  reference: DeckThemeInput | undefined,
  hostMode?: DeckResolvedThemeMode
): DeckResolvedThemeMode {
  const own = typeof reference === 'object' ? reference.mode : undefined;
  if (own !== undefined && own !== 'system') return own;
  return hostMode ?? 'light';
}
