/**
 * Layout media and block-shaped props.
 *
 * - Images and videos paint with the `@texuli/media` `Image` and
 *   `VideoPlayer` components at the host's URL-policy tier. Sources are
 *   checked here first (`safeImageSrc` / `safeMediaSrc` through the media
 *   resolvers) so a refused source shows the stage's refused-media notice
 *   instead of an empty frame. Layout props accept `https:` sources (deck
 *   model v2), which the content-block media schema does not, so layout
 *   media never goes through image blocks.
 * - Avatar ids (`av-001`, `avatar:av-001`) resolve through the host adapter,
 *   whose URLs are held to the developer tier.
 * - `code` and the chart `spec` are block-shaped: they paint as `code` and
 *   `chart` blocks through the stage's block renderer (lazy families), after
 *   the block schema checks them once more.
 */
import { type Block, safeParseBlock } from '@texuli/blocks/core';
import { stripStepFields } from '@texuli/deck/model';
import { resolveImageSources } from '@texuli/media/image';
import { resolveVideoSources } from '@texuli/media/video';
import { type DeckMediaTrust, deckAvatarResolver } from '../stage/media.ts';

/** The canvas size a layout image or video assumes when the author gave no dimensions. */
export const LAYOUT_MEDIA_DEFAULT_SIZE = Object.freeze({ width: 1280, height: 720 });

const AVATAR_ID = /^(?:avatar:)?(av-[0-9]{3})$/;

/** The avatar id in a value (`av-001` or `avatar:av-001`), else `undefined`. */
export function avatarId(value: string): string | undefined {
  return AVATAR_ID.exec(value)?.[1];
}

/**
 * The image URL a layout may paint at `tier`, or `undefined` when the policy
 * refuses it (or an avatar id has no host adapter).
 */
export function layoutImageSrc(
  src: string,
  tier: DeckMediaTrust,
  resolveAvatar?: (id: string) => string | undefined
): string | undefined {
  const id = avatarId(src);
  if (id !== undefined) return deckAvatarResolver(resolveAvatar)?.(id);
  return resolveImageSources({ src, trust: tier }).src;
}

/** The video URL a layout may paint at `tier`; `src` is `undefined` when refused. */
export function layoutVideoSrc(src: string, tier: DeckMediaTrust) {
  const resolved = resolveVideoSources({ src, trust: tier });
  return { src: resolved.src };
}

function checked(value: Record<string, unknown>): Block | null {
  const parsed = safeParseBlock(value);
  return parsed.success ? parsed.data : null;
}

/** The code block of `code-with-callout` (its highlights step through the code family). */
export function layoutCodeBlock(code: {
  lang: string;
  source: string;
  highlights?: readonly string[];
}): Block | null {
  return checked({
    type: 'code',
    lang: code.lang,
    code: code.source,
    ...(code.highlights && code.highlights.length > 0 ? { highlights: [...code.highlights] } : {}),
  });
}

/** The chart block of the `chart` layout: the spec without its step fields, typed `chart`. */
export function layoutChartBlock(spec: unknown): Block | null {
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) return null;
  return checked({ ...stripStepFields(spec as Record<string, unknown>), type: 'chart' });
}

/** The `cta` block of `closing-cta`, or `null` when the block schema refuses the href. */
export function layoutCtaBlock(cta: { label: string; href: string }): Block | null {
  return checked({ type: 'cta', actions: [{ label: cta.label, href: cta.href }] });
}

/** Up to two initials for a name, by code point (`Ada Example` → `AE`). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0]];
  return picked
    .map((word) => [...(word ?? '')][0] ?? '')
    .join('')
    .toLocaleUpperCase();
}
