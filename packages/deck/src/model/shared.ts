/**
 * Schemas every part of deck model v2 shares: ids, text, step markers,
 * transitions and media syntax (ADR-009). The engine checks syntax only; the
 * stage applies the URL policy at the host's tier when it paints.
 */
import { t } from '../schema/index.ts';

/** Slide, section and block ids: lowercase slug, 1 to 64 characters. */
export const SLIDE_ID_PATTERN = '^[a-z0-9][a-z0-9-]{0,63}$';

export const slideId = t.string({ pattern: SLIDE_ID_PATTERN, max: 64 });

/** A trimmed single-line string of at most `max` code points. */
export function line(max: number, min = 0) {
  return t.string({ min, max, trim: true, text: 'line' });
}

/** A multi-line string (notes, captions) of at most `max` code points. */
export function multiline(max: number) {
  return t.string({ max, text: 'multiline' });
}

/** The v2 fragment effects (Protoyard's vocabulary). */
export const FRAGMENT_EFFECTS = [
  'in',
  'fade-up',
  'out',
  'in-then-out',
  'grow',
  'shrink',
  'highlight',
  'strike',
] as const;
export type FragmentEffect = (typeof FRAGMENT_EFFECTS)[number];

/** The legacy block reveal vocabulary (Texuli v1), mapped onto fragments. */
export const BLOCK_REVEALS = ['fade', 'fade-up', 'grow', 'highlight', 'strike'] as const;
export type BlockReveal = (typeof BLOCK_REVEALS)[number];

/** Highlight tones (reveal.js `highlight-red`/`-blue` map onto these). */
export const FRAGMENT_TONES = ['accent', 'info', 'success', 'warning', 'danger'] as const;
export type FragmentTone = (typeof FRAGMENT_TONES)[number];

/** The most distinct steps one slide may have (more is an error). */
export const MAX_SLIDE_STEPS = 32;
/** The largest authored step number before dense renumbering. */
export const MAX_AUTHORED_STEP = 1000;

/**
 * Step fields any block, component item or steppable props object may carry.
 * `fragment` and `reveal` are mutually exclusive (checked by the steps pass).
 */
export const stepFields = {
  step: t.optional(t.int({ min: 0, max: MAX_AUTHORED_STEP })),
  fragment: t.optional(t.enum(FRAGMENT_EFFECTS)),
  reveal: t.optional(t.enum(BLOCK_REVEALS)),
  tone: t.optional(t.enum(FRAGMENT_TONES)),
} as const;

export const DECK_TRANSITIONS = ['none', 'fade', 'fade-up', 'slide', 'zoom', 'morph'] as const;
export type DeckTransition = (typeof DECK_TRANSITIONS)[number];
export const deckTransition = t.enum(DECK_TRANSITIONS);

export const DECK_ASPECTS = ['16:9', '4:3', '9:16', '1:1'] as const;
export type DeckAspect = (typeof DECK_ASPECTS)[number];

/** The fixed virtual canvas for each aspect, in CSS pixels. */
export const DECK_CANVAS: Readonly<Record<DeckAspect, { width: number; height: number }>> =
  Object.freeze({
    '16:9': { width: 1280, height: 720 },
    '4:3': { width: 1024, height: 768 },
    '9:16': { width: 720, height: 1280 },
    '1:1': { width: 1080, height: 1080 },
  });

/**
 * An SVG path ending, in any letter case, with the dot and the end marker
 * also percent-encoded: `.svg`, `.SVG`, `%2esvg`, then `?`, `#`, `%3F`,
 * `%23` or the end. A character class per letter, not the `i` flag: the
 * pattern travels as a JSON Schema `pattern` string.
 */
const SVG_ENDING = '(?:\\.|%2[eE])[sS][vV][gG](?:[?#]|%(?:3[fF]|23)|$)';

/**
 * Media source syntax: an `https:` URL, a relative path without `..`,
 * backslashes or SVG (any case, also percent-encoded), a base64 `data:`
 * raster or video, or an `avatar:` id. Size caps for `data:` and the trust
 * tier are the host's, applied later.
 */
export const MEDIA_SRC_PATTERN = `^(?:https://(?![^?#]*${SVG_ENDING})[^\\s"<>\\\\]+|(?!/)(?!.*\\.\\.)(?!.*${SVG_ENDING})[A-Za-z0-9._~/-]+(?:[?#][^\\s"<>\\\\]*)?|data:(?:image/(?:png|jpeg|gif|webp|avif)|video/(?:mp4|webm));base64,[A-Za-z0-9+/=]+|avatar:av-[0-9]{3})$`;

export const mediaSrc = t.string({ min: 1, max: 2_000_000, pattern: MEDIA_SRC_PATTERN });

/**
 * Link syntax: `https:`, `mailto:`, a fragment, the deck's own route
 * (`#/<slide-id>` or `#/<slide-id>/<step>`, step 0 to 32, as `parseDeckHash`
 * reads it) or a relative path.
 */
export const LINK_HREF_PATTERN =
  '^(?:https://[^\\s"<>\\\\]+|mailto:[^\\s"<>\\\\]+|#[A-Za-z0-9._~-]*|#/[a-z0-9][a-z0-9-]{0,63}(?:/(?:[0-9]|[12][0-9]|3[0-2]))?|(?!//)(?!.*\\.\\.)[A-Za-z0-9._~/-]+(?:[?#][^\\s"<>\\\\]*)?)$';

export const linkHref = t.string({ min: 1, max: 2048, pattern: LINK_HREF_PATTERN });

/** Bounded JSON props (Protoyard's limits): depth 4, 100 keys, 200 items. */
export const boundedProps = t.json({ depth: 4 });

/**
 * Catalog component props on a slide: deeper and longer than layout props, so
 * data views and workflow graphs (500 nodes, 2,000 edges) fit. The host's
 * registry validates the content at its tier.
 */
export const componentProps = t.json({ depth: 8, maxItems: 2000 });
